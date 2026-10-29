import type { Request } from "express";
import { Prisma, type Ticket, type UserRole } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { HttpError, requireNormal } from "./auth/http.js";
import { expired } from "./auth/session.js";

export async function retryTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getPrisma().$transaction(work, { timeout: 15000, maxWait: 5000 });
    } catch (error) {
      // Only errors that certify an aborted transaction may retry. Never retry
      // transport failures with an uncertain commit outcome.
      const aborted = error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || (error.code === "P2010" &&
          ["40001", "40P01"].includes(String(error.meta?.code))));
      if (!aborted) throw error;
      if (attempt === 2) throw new HttpError(409, "CONCURRENT_UPDATE", "Concurrent update. Reload and try again.");
    }
  }
}
export async function lockEligibility(tx: Prisma.TransactionClient, exclusive = false) {
  if (exclusive) await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('admin_user_protection'))");
  else await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock_shared(hashtext('admin_user_protection'))");
}
export async function lockTicket(tx: Prisma.TransactionClient, id: number) {
  const rows = await tx.$queryRawUnsafe<{ id: number }[]>('SELECT id FROM "Ticket" WHERE id=$1 FOR UPDATE', id);
  if (!rows.length) throw new HttpError(404, "NOT_FOUND", "Resource not found.");
  return tx.ticket.findUniqueOrThrow({ where: { id } });
}
export async function liveActor(tx: Prisma.TransactionClient, req: Request, roles: readonly UserRole[]) {
  const authenticated = requireNormal(req), hash = req.auth!.session.tokenHash;
  // Hold the live session against logout/password-reset deletion until commit.
  await tx.$queryRawUnsafe('SELECT "tokenHash" FROM "Session" WHERE "tokenHash"=$1 FOR SHARE', hash);
  const session = await tx.session.findUnique({ where: { tokenHash: hash } });
  const user = await tx.user.findUnique({ where: { id: authenticated.id } });
  if (!session || session.userId !== authenticated.id || expired(session, new Date()) || !user?.isActive)
    throw new HttpError(401, "UNAUTHENTICATED", "Please sign in.");
  if (user.mustChangePassword) throw new HttpError(403, "PASSWORD_CHANGE_REQUIRED", "Change your initial password first.");
  if (!roles.includes(user.role)) throw new HttpError(403, "FORBIDDEN", "This operation is not permitted.");
  return user;
}
export function assertCanAdvance(ticket: Pick<Ticket, "workflowVersion">) {
  if (ticket.workflowVersion >= 2147483647)
    throw new HttpError(500, "INTERNAL_ERROR", "Unable to complete the request.");
}
export function assertTicketVersion(ticket: Pick<Ticket, "workflowVersion">, expected: number) {
  if (ticket.workflowVersion !== expected) throw new HttpError(409, "TICKET_VERSION_CONFLICT", "Ticket changed. Reload and review your update.",
    { currentWorkflowVersion: ticket.workflowVersion });
}
// All workflow writers share eligibility -> parent -> live session lock ordering.
export async function ticketWrite<T>(req: Request, id: number, roles: readonly UserRole[],
  work: (tx: Prisma.TransactionClient, ticket: Ticket) => Promise<T>) {
  return retryTransaction(async tx => {
    await lockEligibility(tx);
    const ticket = await lockTicket(tx, id);
    await liveActor(tx, req, roles);
    return work(tx, ticket);
  });
}
