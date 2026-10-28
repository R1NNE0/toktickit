import type { Prisma, Ticket } from "@prisma/client";
import type { ResolutionBlockers } from "./workflow.js";

// Call inside the parent's write lock, or the detail read's repeatable-read snapshot.
// Aggregate in PostgreSQL: a Ticket's full Action history is never loaded for a gate.
export async function resolutionState(tx: Prisma.TransactionClient, ticket: Pick<Ticket, "id" | "ownerId" | "workCycle">): Promise<ResolutionBlockers> {
  const owner = ticket.ownerId === null ? null : await tx.user.findUnique({ where: { id: ticket.ownerId },
    select: { isActive: true, role: true } });
  const [counts] = await tx.$queryRaw<{ completedActions: bigint; incompleteActions: bigint; outstandingFollowUps: bigint }[]>`
    SELECT count(*) FILTER (WHERE status = 'COMPLETED' AND length(btrim(result)) > 0
      AND "performedById" = "assigneeId" AND "completedAt" IS NOT NULL) AS "completedActions",
      count(*) FILTER (WHERE status IN ('PLANNED', 'IN_PROGRESS')) AS "incompleteActions",
      count(*) FILTER (WHERE status = 'COMPLETED' AND "followUpRequired") AS "outstandingFollowUps"
    FROM "ActionTaken" WHERE "ticketId" = ${ticket.id} AND cycle = ${ticket.workCycle}`;
  return { eligibleOwner: !!owner?.isActive && ["IT_STAFF", "ADMINISTRATOR"].includes(owner.role),
    completedActions: Number(counts.completedActions), incompleteActions: Number(counts.incompleteActions),
    outstandingFollowUps: Number(counts.outstandingFollowUps) };
}
