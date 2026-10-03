import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Prisma, PrismaClient, User } from "@prisma/client";
export const COOKIE = "toktickit_session";
export const IDLE_MS = 30 * 60_000;
export const ABSOLUTE_MS = 8 * 60 * 60_000;
export const BOOTSTRAP_MS = 10 * 60_000;
export const opaqueToken = () => randomBytes(32).toString("base64url");
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function expired(session: { createdAt: Date; lastSeenAt: Date; expiresAt: Date; userId: number | null }, now: Date) {
  return now >= session.expiresAt || now.getTime() - session.createdAt.getTime() >= (session.userId === null ? BOOTSTRAP_MS : ABSOLUTE_MS)
    || (session.userId !== null && now.getTime() - session.lastSeenAt.getTime() >= IDLE_MS);
}
export const publicUser = (user: User) => ({
  id: user.id, name: user.name, email: user.email, role: user.role,
  isActive: user.isActive, mustChangePassword: user.mustChangePassword,
});
export function revokeUserSessions(db: Prisma.TransactionClient, userId: number) {
  return db.session.deleteMany({ where: { userId } });
}
export async function newSession(db: Prisma.TransactionClient | PrismaClient, userId: number | null, now: Date) {
  const token = opaqueToken();
  const session = await db.session.create({ data: {
    tokenHash: tokenHash(token), csrfToken: opaqueToken(), userId,
    createdAt: now, lastSeenAt: now,
    expiresAt: new Date(now.getTime() + (userId === null ? BOOTSTRAP_MS : ABSOLUTE_MS)),
  }});
  return { token, session };
}
