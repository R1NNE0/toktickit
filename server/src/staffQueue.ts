import { activeStatuses, dashboardFilters } from "./dashboardQueries.js";
import { Prisma, Priority } from "@prisma/client";
import type { Request, Response } from "express";
import { requireNormal, reject } from "./auth/http.js";
import { requesterQuery } from "./middleware/requesterInput.js";
import { getPrisma } from "./prisma.js";

// Business ranks are independent of PostgreSQL enum storage order.
export const priorityOrder = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const statusOrder = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;

export function staffQuery(query: Record<string, unknown>, userId?: number) {
  const { itPriority, ownerId, ...rest } = query;
  const { common, statusGroup, updated, resolved } = dashboardFilters(rest);
  const invalid = (): never => reject(400, "INVALID_QUERY", "Invalid ticket query parameters.");
  if (itPriority !== undefined && (typeof itPriority !== "string" || !Object.values(Priority).includes(itPriority as Priority))) invalid();
  if (ownerId !== undefined && (typeof ownerId !== "string" || (ownerId !== "unassigned" && ownerId !== "me"
    && (!/^[1-9]\d*$/.test(ownerId) || Number(ownerId) > 2147483647)))) invalid();
  if (ownerId === "me" && !userId) invalid();
  const itSort = common.sortBy === "itPriority";
  const parsed = requesterQuery(itSort ? { ...common, sortBy: "requestedPriority" } : common);
  if (![10, 20, 50].includes(parsed.pageSize)) invalid();
  return { ...parsed, statusGroup, updated, resolved, sortBy: itSort ? "itPriority" : parsed.sortBy, itPriority: itPriority as string | undefined,
    ownerId: ownerId === undefined ? undefined : ownerId === "unassigned" ? null : ownerId === "me" ? userId : Number(ownerId) };
}

const columns: Record<string, Prisma.Sql> = {
  createdAt: Prisma.sql`"createdAt"`, updatedAt: Prisma.sql`"updatedAt"`, ticketNumber: Prisma.sql`"ticketNumber"`,
  requestedPriority: Prisma.sql`"requestedPriority"`, itPriority: Prisma.sql`"itPriority"`, currentStatus: Prisma.sql`"currentStatus"`,
};
function rank(column: Prisma.Sql, values: readonly string[]) {
  return Prisma.sql`CASE ${column}::text ${Prisma.join(values.map((value, index) => Prisma.sql`WHEN ${value} THEN ${index}`), " ")} END`;
}
const queueSelect = {
  id: true, ticketNumber: true, summary: true, description: true, requesterId: true, categoryId: true, relatedSystemId: true,
  requestedPriority: true, itPriority: true, currentStatus: true, ownerId: true, createdAt: true, updatedAt: true,
  workflowVersion: true, workCycle: true, resolvedAt: true, resolutionSuggestedAt: true, resolutionSuggestedById: true,
  requester: { select: { id: true, name: true, email: true } },
  owner: { select: { id: true, name: true, role: true, isActive: true } },
  category: { select: { id: true, name: true } }, relatedSystem: { select: { id: true, name: true } },
  _count: { select: { attachments: { where: { isRemoved: false } } } },
} satisfies Prisma.TicketSelect;

export async function staffQueue(req: Request, res: Response) {
  if (!["IT_STAFF", "ADMINISTRATOR"].includes(requireNormal(req).role))
    reject(403, "FORBIDDEN", "Ticket Queue is available to IT Staff or Administrator.");
  const q = staffQuery(req.query, requireNormal(req).id), db = getPrisma(), filters: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (q.search) filters.push(Prisma.sql`(position(lower(${q.search}) in lower("ticketNumber")) > 0
    OR position(lower(${q.search}) in lower(summary)) > 0 OR position(lower(${q.search}) in lower(description)) > 0)`);
  if (q.categoryId !== undefined) filters.push(Prisma.sql`"categoryId" = ${q.categoryId}`);
  if (q.status) filters.push(Prisma.sql`"currentStatus"::text = ${q.status}`);
  if (q.statusGroup) filters.push(Prisma.sql`"currentStatus"::text IN (${Prisma.join(q.statusGroup === "active" ? activeStatuses : ["RESOLVED", "CLOSED"])})`);
  if (q.updated) filters.push(Prisma.sql`"updatedAt">=(${q.updated.from}::timestamptz AT TIME ZONE 'UTC') AND "updatedAt"<(${q.updated.to}::timestamptz AT TIME ZONE 'UTC')`);
  if (q.resolved) filters.push(Prisma.sql`"resolvedAt">=${q.resolved.from}::timestamptz AND "resolvedAt"<${q.resolved.to}::timestamptz`);
  if (q.priority) filters.push(Prisma.sql`"requestedPriority"::text = ${q.priority}`);
  if (q.itPriority) filters.push(Prisma.sql`"itPriority"::text = ${q.itPriority}`);
  if (q.ownerId === null) filters.push(Prisma.sql`"ownerId" IS NULL`);
  else if (q.ownerId !== undefined) filters.push(Prisma.sql`"ownerId" = ${q.ownerId}`);
  const where = Prisma.join(filters, " AND "), column = columns[q.sortBy];
  const order = q.sortBy === "currentStatus" ? rank(column, statusOrder)
    : ["requestedPriority", "itPriority"].includes(q.sortBy) ? rank(column, priorityOrder) : column;
  const direction = q.sortOrder === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const [counts, ids] = await Promise.all([
    db.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT count(*) AS total FROM "Ticket" WHERE ${where}`),
    db.$queryRaw<{ id: number }[]>(Prisma.sql`SELECT id FROM "Ticket" WHERE ${where}
      ORDER BY ${order} ${direction}, id ${direction} LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`),
  ]);
  const records = await db.ticket.findMany({ where: { id: { in: ids.map(row => row.id) } }, select: queueSelect });
  const byId = new Map(records.map(row => [row.id, row]));
  const data = ids.flatMap(({ id }) => {
    const row = byId.get(id);
    if (!row) return []; // A concurrent deletion can be reconciled by the next refresh.
    const { _count, ...ticket } = row;
    return [{ ...ticket, attachmentCount: _count.attachments }];
  });
  const total = Number(counts[0].total);
  res.setHeader("Cache-Control", "no-store");
  res.json({ data, pagination: { total, totalItems: total, page: q.page, currentPage: q.page,
    pageSize: q.pageSize, limit: q.pageSize, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) } });
}
