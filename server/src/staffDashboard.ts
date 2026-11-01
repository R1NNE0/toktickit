import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { requireNormal, reject } from "./auth/http.js";
import { getPrisma } from "./prisma.js";
import { priorityOrder, statusOrder } from "./staffQueue.js";
import { activeStatuses, outstandingPredicate } from "./dashboardQueries.js";

// Injectable only inside the test process; callers cannot select the snapshot time.
export const dashboardClock = { now: async (tx: Prisma.TransactionClient) =>
  (await tx.$queryRaw<{ now: Date }[]>`SELECT date_trunc('milliseconds', transaction_timestamp()) AS now`)[0].now };

export async function staffDashboard(req: Request, res: Response) {
  const user = requireNormal(req);
  if (!["IT_STAFF", "ADMINISTRATOR"].includes(user.role)) reject(403, "FORBIDDEN", "Operational dashboard is available to Staff and Administrators.");
  if (Object.keys(req.query).length || (req.body && Object.keys(req.body).length)) reject(400, "INVALID_QUERY", "Dashboard does not accept query or body fields.");
  const result = await getPrisma().$transaction(async tx => {
    const to = await dashboardClock.now(tx), from = new Date(to.getTime() - 168 * 3600000);
    const active = Prisma.sql`"currentStatus"::text IN (${Prisma.join(activeStatuses)})`;
    const columns = [Prisma.sql`count(*) FILTER (WHERE ${active} AND "ownerId" IS NULL)::int AS unassigned`,
      Prisma.sql`count(*) FILTER (WHERE ${active} AND "ownerId"=${user.id})::int AS mine`,
      ...statusOrder.map(s => Prisma.sql`count(*) FILTER (WHERE "currentStatus"::text=${s})::int AS ${Prisma.raw('"' + s + '"')}`),
      ...priorityOrder.map(p => Prisma.sql`count(*) FILTER (WHERE ${active} AND "itPriority"::text=${p})::int AS ${Prisma.raw('"' + p + '"')}`)];
    const [counts] = await tx.$queryRaw<Record<string, number>[]>(Prisma.sql`SELECT ${Prisma.join(columns)} FROM "Ticket"`);
    const predicate = outstandingPredicate(user.id);
    const [actions] = await tx.$queryRaw<{ total: number }[]>(Prisma.sql`SELECT count(*)::int AS total FROM "ActionTaken" a JOIN "Ticket" t ON t.id=a."ticketId" WHERE ${predicate}`);
    const recentTickets = await tx.$queryRaw(Prisma.sql`SELECT t.id,t."ticketNumber",t.summary,t."currentStatus",t."requestedPriority",t."itPriority",t."updatedAt",t."resolvedAt",
      CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id',u.id,'name',u.name,'role',u.role,'isActive',u."isActive") END AS owner
      FROM "Ticket" t LEFT JOIN "RequesterUser" u ON u.id=t."ownerId"
      WHERE t."updatedAt">=(${from}::timestamptz AT TIME ZONE 'UTC') AND t."updatedAt"<(${to}::timestamptz AT TIME ZONE 'UTC')
      ORDER BY t."updatedAt" DESC,t.id DESC LIMIT 5`);
    const items = await tx.$queryRaw(Prisma.sql`SELECT a.id,a."ticketId",a.cycle,a.status,left(a.description,200) AS "descriptionExcerpt",a."createdAt",
      json_build_object('id',t.id,'ticketNumber',t."ticketNumber",'summary',t.summary,'currentStatus',t."currentStatus") AS ticket
      FROM "ActionTaken" a JOIN "Ticket" t ON t.id=a."ticketId" WHERE ${predicate} ORDER BY a."createdAt",a.id LIMIT 5`);
    const queue = (filters: object) => ({ view: "staff-queue", filters });
    const map = <T>(keys: readonly string[], fn: (key: string) => T) => Object.fromEntries(keys.map(key => [key, fn(key)]));
    return { generatedAt: to.toISOString(), timezone: "Asia/Bangkok", recentWindow: { from: from.toISOString(), to: to.toISOString() }, recentTickets,
      metrics: { unassignedActiveTickets: counts.unassigned, myActiveTickets: counts.mine,
        ticketsByStatus: map(statusOrder, s => counts[s]), activeTicketsByItPriority: map(priorityOrder, p => counts[p]), myOutstandingActions: actions.total },
      myActions: { total: actions.total, items }, drilldowns: {
        unassignedActiveTickets: queue({ statusGroup: "active", ownerId: "unassigned" }), myActiveTickets: queue({ statusGroup: "active", ownerId: "me" }),
        ticketsByStatus: map(statusOrder, status => queue({ status })), activeTicketsByItPriority: map(priorityOrder, itPriority => queue({ statusGroup: "active", itPriority })),
        myOutstandingActions: { view: "my-actions", filters: { assigneeId: "me", state: "outstanding" } },
        recentTickets: queue({ updatedFrom: from.toISOString(), updatedTo: to.toISOString(), sortBy: "updatedAt", sortOrder: "desc" }) } };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  res.set("Cache-Control", "no-store").json(result);
}
