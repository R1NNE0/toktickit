import { Router, type Request, type Response, type NextFunction, type ErrorRequestHandler } from "express";
import type { PrismaClient, Session, User } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { hashPassword, normalizeEmail, passwordError, validEmail, verifyPassword } from "./password.js";
import { COOKIE, expired, newSession, publicUser, revokeUserSessions, sameSecret, tokenHash } from "./session.js";
import { LoginThrottle } from "./throttle.js";

declare global { namespace Express { interface Request { auth?: { session: Session; user: User | null }; } } }
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const reject = (status: number, code: string, message: string): never => { throw new HttpError(status, code, message); };
export const asyncRoute = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };
export const authErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) { res.status(error.status).json({ error: error.message, code: error.code }); return; }
  const status = error?.type === "entity.too.large" ? 413 : error instanceof SyntaxError ? 400 : 500;
  res.status(status).json({ error: status === 500 ? "Unable to complete the request." : "Invalid request.",
    code: status === 500 ? "INTERNAL_ERROR" : status === 413 ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR" });
};
export function requireSession(req: Request): User {
  if (!req.auth?.user) return reject(401, "UNAUTHENTICATED", "Please sign in.");
  return req.auth.user;
}
export function requireNormal(req: Request): User {
  const user = requireSession(req);
  if (user.mustChangePassword) return reject(403, "PASSWORD_CHANGE_REQUIRED", "Change your initial password first.");
  return user;
}
export function authConfig() {
  const origin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
  const parsed = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  const allowHttp = process.env.AUTH_ALLOW_HTTP_LOCALHOST === "true";
  if (allowHttp && (!local || parsed.protocol !== "http:")) throw new Error("HTTP cookies require an explicit localhost origin.");
  return { origin: parsed.origin, secure: !allowHttp };
}
export function createAuth(options: { db?: () => PrismaClient; now?: () => Date; config?: ReturnType<typeof authConfig> } = {}) {
  const db = options.db ?? getPrisma, now = options.now ?? (() => new Date());
  const config = options.config ?? authConfig(), throttle = new LoginThrottle();
  const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: config.secure, path: "/" };
  let dummyHash: Promise<string> | undefined;
  const cookie = (res: Response, token: string) => res.cookie(COOKIE, token, cookieOptions);
  const load = asyncRoute(async (req, res, next) => {
    const values = (req.headers.cookie ?? "").split(";").map(v => v.trim()).filter(v => v.startsWith(COOKIE + "="));
    if (values.length === 1) {
      const token = values[0].slice(COOKIE.length + 1);
      if (/^[A-Za-z0-9_-]{43}$/.test(token)) {
        const session = await db().session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
        if (session) {
          if (expired(session, now()) || (session.user && !session.user.isActive)) {
            if (session.user && !session.user.isActive) await revokeUserSessions(db(), session.user.id);
            else await db().session.deleteMany({ where: { tokenHash: session.tokenHash } });
            res.clearCookie(COOKIE, cookieOptions);
          } else {
            const touched = await db().session.updateMany({ where: { tokenHash: session.tokenHash }, data: { lastSeenAt: now() } });
            if (touched.count) req.auth = { session, user: session.user };
          }
        }
      }
    }
    next();
  });
  const csrf = (req: Request) => {
    if (!config.secure && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(req.hostname))
      reject(403, "CSRF_INVALID", "Request origin is not allowed.");
    if (req.get("Origin") !== config.origin || !req.auth || !sameSecret(req.get("X-CSRF-Token") ?? "", req.auth.session.csrfToken))
      reject(403, "CSRF_INVALID", "Refresh the page and try again.");
  };
  const mutation = (req: Request, _res: Response, next: NextFunction) => {
    try { requireNormal(req); csrf(req); next(); } catch (e) { next(e); }
  };
  const router = Router();
  router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  router.get("/csrf", asyncRoute(async (req, res) => {
    if (req.auth) { res.json({ csrfToken: req.auth.session.csrfToken }); return; }
    const created = await newSession(db(), null, now()); cookie(res, created.token);
    res.json({ csrfToken: created.session.csrfToken });
  }));
  router.get("/me", asyncRoute(async (req, res) => { res.json({ user: publicUser(requireSession(req)) }); }));
  router.post("/login", asyncRoute(async (req, res) => {
    if (req.auth?.user?.mustChangePassword) reject(403, "PASSWORD_CHANGE_REQUIRED", "Change your initial password first.");
    csrf(req);
    const { email, password } = req.body ?? {};
    if (!validEmail(email) || typeof password !== "string" || !password.length || [...password].length > 128
      || Object.keys(req.body).some(k => !["email", "password"].includes(k)))
      reject(400, "VALIDATION_ERROR", "Enter a valid email and password.");
    const normalized = normalizeEmail(email), ip = req.ip ?? "unknown";
    const retry = throttle.check(normalized, ip, now().getTime());
    if (retry) { res.set("Retry-After", String(retry)); reject(429, "RATE_LIMITED", "Too many attempts. Try again later."); }
    // Expansion-stage rows may not have credentials yet; treat them as a safe
    // credential failure rather than letting Prisma's final required projection throw.
    const [user] = await db().$queryRaw<(Omit<User, "passwordHash"> & { passwordHash: string | null })[]>
      `SELECT * FROM "RequesterUser" WHERE "emailNormalized" = ${normalized} LIMIT 1`;
    dummyHash ??= hashPassword("Dummy credential for verification only!");
    const valid = await verifyPassword(user?.passwordHash || await dummyHash, password);
    const fail = () => { throttle.failed(normalized, ip, now().getTime()); return reject(401, "INVALID_CREDENTIALS", "Unable to sign in. Check your credentials or contact your administrator."); };
    if (!valid || !user?.isActive || !user.passwordHash) return fail();
    const created = await db().$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "RequesterUser" WHERE id = ${user.id} FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (!current.isActive || current.passwordHash !== user.passwordHash) return fail();
      const consumed = await tx.session.deleteMany({ where: { tokenHash: req.auth!.session.tokenHash } });
      if (!consumed.count) reject(401, "UNAUTHENTICATED", "Refresh the page and try again.");
      return { ...await newSession(tx, user.id, now()), user: current };
    });
    cookie(res, created.token); res.json({ user: publicUser(created.user), csrfToken: created.session.csrfToken });
  }));
  router.post("/change-password", asyncRoute(async (req, res) => {
    const user = requireSession(req); csrf(req);
    const { currentPassword, newPassword, confirmPassword } = req.body ?? {};
    if (Object.keys(req.body ?? {}).some(k => !["currentPassword", "newPassword", "confirmPassword"].includes(k))
      || typeof currentPassword !== "string" || [...currentPassword].length > 128 || passwordError(newPassword)
      || newPassword !== confirmPassword || currentPassword === newPassword
      || !(await verifyPassword(user.passwordHash, currentPassword)))
      reject(400, "VALIDATION_ERROR", "Check your current password, password rules and confirmation.");
    const passwordHash = await hashPassword(newPassword);
    const result = await db().$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "RequesterUser" WHERE id = ${user.id} FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      const liveSession = await tx.session.findUnique({ where: { tokenHash: req.auth!.session.tokenHash } });
      if (!liveSession || expired(liveSession, now()) || !current.isActive || current.passwordHash !== user.passwordHash)
        reject(401, "UNAUTHENTICATED", "Please sign in.");
      const changed = await tx.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false, passwordChangedAt: now() } });
      // Compete atomically with logout for the original session. A prior read
      // alone cannot authorize rotation: logout may have deleted it meanwhile.
      // DELETE holds the row lock until commit; if logout won, roll back the
      // password/flag update as well and never issue a replacement cookie.
      const consumed = await tx.session.deleteMany({ where: { tokenHash: req.auth!.session.tokenHash, userId: user.id } });
      if (consumed.count !== 1) reject(401, "UNAUTHENTICATED", "Please sign in.");
      await revokeUserSessions(tx, user.id);
      return { ...await newSession(tx, user.id, now()), user: changed };
    });
    cookie(res, result.token); res.json({ user: publicUser(result.user), csrfToken: result.session.csrfToken });
  }));
  router.post("/logout", asyncRoute(async (req, res) => {
    if (!req.auth?.user) { res.clearCookie(COOKIE, cookieOptions); reject(401, "UNAUTHENTICATED", "Please sign in."); }
    csrf(req);
    await db().session.deleteMany({ where: { tokenHash: req.auth!.session.tokenHash } });
    res.clearCookie(COOKIE, cookieOptions); res.status(204).end();
  }));
  return { load, router, mutation, config };
}
