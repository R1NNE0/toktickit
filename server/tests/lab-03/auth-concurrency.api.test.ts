import { afterAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "../../src/prisma.js";
import { createAuth, authErrorHandler } from "../../src/auth/http.js";
import { hashPassword, verifyPassword } from "../../src/auth/password.js";

function barrier() {
  let release!: () => void;
  const reached = new Promise<void>(resolve => { release = resolve; });
  return { reached, release };
}

const db = getPrisma();
const origin = "http://localhost:5173";
const initial = "Concurrency fixture initial password";
const replacement = "Concurrency fixture replacement password";

describe("API-02/03 concurrent password change and logout", () => {
  afterAll(async () => { await db.$disconnect(); });

  it.each([false, true])("does not rotate after logout wins (mustChangePassword=%s)", async mustChangePassword => {
    const email = randomUUID() + "@example.com";
    const before = await db.user.create({ data: { name: "Concurrency fixture", email, emailNormalized: email,
      passwordHash: await hashPassword(initial), mustChangePassword } });
    const validated = barrier(), resume = barrier();
    // Pause only this user's password write, after the handler has validated the
    // live session inside its transaction. Every database operation still runs
    // against PostgreSQL; no query results or transaction semantics are mocked.
    const coordinated = db.$extends({ query: { user: {
      async update({ args, query }) {
        if (args.where.id === before.id && args.data.passwordHash) {
          validated.release();
          await resume.reached;
        }
        return query(args);
      },
    } } });
    const app = express();
    // Prisma's extended client retains the methods used by createAuth; its
    // generated type omits unused base-client methods such as $on.
    const auth = createAuth({ db: () => coordinated as unknown as PrismaClient, config: { origin, secure: false } });
    app.use(express.json(), auth.load);
    app.use("/api/auth", auth.router);
    app.use(authErrorHandler);
    const browser = request.agent(app);
    const bootstrap = await browser.get("/api/auth/csrf").expect(200);
    const login = await browser.post("/api/auth/login").set("Origin", origin)
      .set("X-CSRF-Token", bootstrap.body.csrfToken).send({ email, password: initial }).expect(200);
    const originalCookie = login.headers["set-cookie"][0].split(";")[0];
    const changing = browser.post("/api/auth/change-password").set("Origin", origin)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ currentPassword: initial, newPassword: replacement, confirmPassword: replacement })
      .then(response => response);
    try {
      // Event barriers, not sleeps, force logout to commit in the validation/
      // rotation gap that previously permitted resurrection.
      await Promise.race([validated.reached, changing.then(() => { throw new Error("Password change completed before the barrier."); })]);
      await browser.post("/api/auth/logout").set("Origin", origin)
        .set("X-CSRF-Token", login.body.csrfToken).send({}).expect(204);
      expect(await db.session.count({ where: { userId: before.id } })).toBe(0);
      resume.release();
      const changed = await changing;
      expect(changed.status).toBe(401);
      expect(changed.body.code).toBe("UNAUTHENTICATED");
      expect(changed.headers["set-cookie"]).toBeUndefined();
      expect(changed.body).not.toHaveProperty("csrfToken");
      expect(await db.session.count({ where: { userId: before.id } })).toBe(0);
      // The failed rotation must roll back the credential change and flag too.
      const after = await db.user.findUniqueOrThrow({ where: { id: before.id } });
      expect(after).toEqual(before);
      expect(await verifyPassword(after.passwordHash, initial)).toBe(true);
      expect(await verifyPassword(after.passwordHash, replacement)).toBe(false);
      await browser.get("/api/auth/me").expect(401);
      await request(app).get("/api/auth/me").set("Cookie", originalCookie).expect(401);
    } finally {
      resume.release();
      await changing;
    }
  });
});
