import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { requireNormal, reject } from "./auth/http.js";
import { getPrisma } from "./prisma.js";
import { activeStatuses } from "./dashboardQueries.js";
import { dashboardClock } from "./staffDashboard.js";

export async function requesterDashboard(req: Request, res: Response) {
  const user = requireNormal(req);
  if (user.role !== "REQUESTER") reject(403, "FORBIDDEN", "Requester dashboard is available to Requesters only.");
  if (Object.keys(req.query).length || (req.body && Object.keys(req.body).length)) reject(400, "INVALID_QUERY", "Dashboard does not accept query or body fields.");
  const result = await getPrisma().$transaction(async tx => {
    const to = await dashboardClock.now(tx), from = new Date(+to - 168 * 3600000);
    const updated = Prisma.sql`t."updatedAt">=(${from}::timestamptz AT TIME ZONE 'UTC') AND t."updatedAt"<(${to}::timestamptz AT TIME ZONE 'UTC')`;
    const [metrics] = await tx.$queryRaw<Record<string, number>[]>(Prisma.sql`SELECT
      count(*) FILTER (WHERE t."currentStatus"::text IN (${Prisma.join(activeStatuses)}))::int AS "activeTickets",
      count(*) FILTER (WHERE t."currentStatus"='WAITING_FOR_REQUESTER')::int AS "waitingForYou",
      count(*) FILTER (WHERE t."currentStatus" IN ('RESOLVED','CLOSED') AND t."resolvedAt">=${from}::timestamptz AND t."resolvedAt"<${to}::timestamptz)::int AS "resolvedLast7Days",
      count(*) FILTER (WHERE ${updated})::int AS "updatedLast7Days"
      FROM "Ticket" t WHERE t."requesterId"=${user.id}`);
    const recentTickets = await tx.$queryRaw(Prisma.sql`SELECT t.id,t."ticketNumber",t.summary,t."currentStatus",t."requestedPriority",t."itPriority",t."updatedAt",t."resolvedAt",
      CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id',u.id,'name',u.name,'role',u.role,'isActive',u."isActive") END AS owner
      FROM "Ticket" t LEFT JOIN "RequesterUser" u ON u.id=t."ownerId"
      WHERE t."requesterId"=${user.id} AND ${updated} ORDER BY t."updatedAt" DESC,t.id DESC LIMIT 5`);
    const list = (filters: object) => ({ view: "my-tickets", filters });
    const recent = list({ updatedFrom: from.toISOString(), updatedTo: to.toISOString(), sortBy: "updatedAt", sortOrder: "desc" });
    return { generatedAt: to.toISOString(), timezone: "Asia/Bangkok", recentWindow: { from: from.toISOString(), to: to.toISOString() }, metrics, recentTickets,
      drilldowns: { activeTickets: list({ statusGroup: "active" }), waitingForYou: list({ status: "WAITING_FOR_REQUESTER" }),
        resolvedLast7Days: list({ statusGroup: "resolved", resolvedFrom: from.toISOString(), resolvedTo: to.toISOString() }),
        updatedLast7Days: recent, recentTickets: recent } };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  res.set("Cache-Control", "no-store").json(result);
}
