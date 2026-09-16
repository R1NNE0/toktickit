import { getPrisma } from "../../src/prisma.js";
import { newSession, COOKIE } from "../../src/auth/session.js";
import { assertTestEnvironment } from "./safety.js";
// Real PostgreSQL session fixtures for historical business tests; login itself is tested with cookie agents.
export async function requesterHeaders(id: number) {
  assertTestEnvironment();
  const created = await newSession(getPrisma(), id, new Date());
  return { Cookie: COOKIE + "=" + created.token, Origin: "http://localhost:5173", "X-CSRF-Token": created.session.csrfToken };
}
