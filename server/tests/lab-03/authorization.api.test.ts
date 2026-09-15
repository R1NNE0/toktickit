import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth/password.js";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
// API-05: Issue 2 authentication/restricted-session portion only.
// Role/resource matrix and future routes are deliberately reserved for Issue 3+.
describe("API-05 Issue 2 protected endpoint gate", () => {
  it("rejects every existing protected operation without a session and before file writes", async () => {
    const paths = [
      ["get", "/api/tickets"], ["post", "/api/tickets"], ["get", "/api/tickets/1"],
      ["post", "/api/tickets/1/attachments"], ["get", "/api/attachments/1/download"],
      ["delete", "/api/attachments/1"]
    ] as const;
    const before = await readdir(process.env.TEST_UPLOAD_ROOT!);
    for (const [method, path] of paths) {
      const response = await request(app)[method](path).set("x-requester-id", "1").send({});
      expect(response.status).toBe(401);
      expect(response.body.code).toBe("UNAUTHENTICATED");
    }
    expect(await readdir(process.env.TEST_UPLOAD_ROOT!)).toEqual(before);
  });
  it("blocks normal reads/writes for a restricted cookie even with valid CSRF", async () => {
    const email = randomUUID() + "@example.com", password = "Restricted initial password";
    await getPrisma().user.create({ data: { name: "Restricted", email, emailNormalized: email, passwordHash: await hashPassword(password) } });
    const agent = request.agent(app), boot = await agent.get("/api/auth/csrf").expect(200);
    const login = await agent.post("/api/auth/login").set("Origin", "http://localhost:5173")
      .set("X-CSRF-Token", boot.body.csrfToken).send({ email, password }).expect(200);
    for (const [method, path] of [
      ["get", "/api/tickets"], ["post", "/api/tickets"], ["get", "/api/tickets/1"],
      ["post", "/api/tickets/1/attachments"], ["get", "/api/attachments/1/download"], ["delete", "/api/attachments/1"]
    ] as const) {
      const response = await agent[method](path).set("Origin", "http://localhost:5173")
        .set("X-CSRF-Token", login.body.csrfToken).send({});
      expect(response.status).toBe(403);
      expect(response.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
    }
  });
});
