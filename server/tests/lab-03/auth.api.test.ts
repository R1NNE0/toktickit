import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { getPrisma } from "../../src/prisma.js";
import { app } from "../../src/app.js";
import { createAuth, authErrorHandler } from "../../src/auth/http.js";
import { hashPassword, verifyPassword } from "../../src/auth/password.js";
import { tokenHash, COOKIE, IDLE_MS, ABSOLUTE_MS } from "../../src/auth/session.js";
const db = getPrisma(), origin = "http://localhost:5173";
const initial = "Initial test password! 0123", replacement = "Changed test password! 4567";
let serial = 0;
async function user(options = {}) {
  const email = "auth-" + Date.now() + "-" + serial++ + "@example.com";
  return db.user.create({ data: { name: "Auth fixture", email, emailNormalized: email,
    passwordHash: await hashPassword(initial), ...options } });
}
async function browser(target = app) {
  const agent = request.agent(target);
  const boot = await agent.get("/api/auth/csrf").expect(200);
  let csrf = boot.body.csrfToken;
  return { agent, boot, get csrf() { return csrf; },
    async post(path: string, body = {}) {
      const res = await agent.post("/api/auth/" + path).set("Origin", origin).set("X-CSRF-Token", csrf).send(body);
      if (res.body.csrfToken) csrf = res.body.csrfToken;
      return res;
    }
  };
}
const cookie = (res: any): string => res.headers["set-cookie"][0].split(";")[0];
describe("API-01/02/03/04 authentication", () => {
  afterAll(async () => { await db.$disconnect(); });
  it("rejects old header authentication before touching ticket data", async () => {
    await request(app).get("/api/tickets").set("x-requester-id", "1").expect(401);
  });
  it("bootstraps nonpersistent HttpOnly SameSite cookies and returns only safe session identity", async () => {
    const u = await user({ mustChangePassword: false });
    const b = await browser();
    expect(b.boot.headers["cache-control"]).toBe("no-store");
    expect(b.boot.headers["set-cookie"][0]).toMatch(/HttpOnly/);
    expect(b.boot.headers["set-cookie"][0]).toMatch(/SameSite=Lax/);
    expect(b.boot.headers["set-cookie"][0]).not.toMatch(/Domain=|Max-Age=/);
    const login = await b.post("login", { email: "  " + u.email.toUpperCase() + " ", password: initial });
    expect(login.status).toBe(200);
    expect(cookie(login)).not.toBe(cookie(b.boot));
    expect(login.body.csrfToken).not.toBe(b.boot.body.csrfToken);
    expect(Object.keys(login.body.user).sort()).toEqual(["email", "id", "isActive", "mustChangePassword", "name", "role"]);
    const token = cookie(login).slice(COOKIE.length + 1);
    expect(await db.session.findUnique({ where: { tokenHash: token } })).toBeNull();
    expect(await db.session.findUnique({ where: { tokenHash: tokenHash(token) } })).not.toBeNull();
    const me = await b.agent.get("/api/auth/me?requesterId=999").set("x-requester-id", "999").expect(200);
    expect(me.body.user.id).toBe(u.id);
    await request(app).get("/api/auth/me").set("Cookie", cookie(b.boot)).expect(401);
    const logout = await b.post("logout");
    expect(logout.status).toBe(204);
    await request(app).get("/api/auth/me").set("Cookie", cookie(login)).expect(401);
    expect((await b.post("logout")).status).toBe(401);
  });
  it("returns identical safe failures for unknown, wrong and inactive credentials", async () => {
    const active = await user(), inactive = await user({ isActive: false });
    const b = await browser();
    const responses = [];
    for (const [email, password] of [["missing@example.com", initial], [active.email, "wrong"], [inactive.email, initial]]) {
      const r = await b.post("login", { email, password }); expect(r.status).toBe(401); responses.push(r.body);
    }
    expect(responses[0]).toEqual(responses[1]); expect(responses[1]).toEqual(responses[2]);
  });
  it("allows only restricted endpoints, rejects same/other-account re-login, validates and rotates password change", async () => {
    const u = await user(), other = await user({ mustChangePassword: false });
    const b = await browser(), second = await browser();
    const logged = await b.post("login", { email: u.email, password: initial });
    const parallel = await second.post("login", { email: u.email, password: initial });
    expect(logged.status).toBe(200); expect(logged.body.user.mustChangePassword).toBe(true);
    await b.agent.get("/api/auth/me").expect(200);
    await b.agent.get("/api/auth/csrf").expect(200);
    for (const path of ["/api/tickets", "/api/requesters/active", "/api/categories"]) {
      const denied = await b.agent.get(path).expect(403);
      expect(denied.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
    }
    for (const email of [u.email, other.email]) {
      const denied = await b.post("login", { email, password: initial });
      expect(denied.status).toBe(403); expect(denied.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
      expect(denied.headers["set-cookie"]).toBeUndefined();
      expect((await b.agent.get("/api/auth/me")).body.user.id).toBe(u.id);
    }
    for (const body of [
      { currentPassword: "wrong", newPassword: replacement, confirmPassword: replacement },
      { currentPassword: initial, newPassword: initial, confirmPassword: initial },
      { currentPassword: initial, newPassword: "short", confirmPassword: "short" },
      { currentPassword: initial, newPassword: replacement, confirmPassword: "mismatch" }
    ]) expect((await b.post("change-password", body)).status).toBe(400);
    expect((await b.agent.get("/api/auth/me")).body.user.mustChangePassword).toBe(true);
    const changed = await b.post("change-password", { currentPassword: initial, newPassword: replacement, confirmPassword: replacement });
    expect(changed.status).toBe(200); expect(changed.body.user.mustChangePassword).toBe(false);
    expect(cookie(changed)).not.toBe(cookie(logged));
    for (const old of [logged, parallel]) await request(app).get("/api/auth/me").set("Cookie", cookie(old)).expect(401);
    const stored = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(stored.passwordChangedAt).not.toBeNull();
    expect(await verifyPassword(stored.passwordHash, replacement)).toBe(true);
    expect(await verifyPassword(stored.passwordHash, initial)).toBe(false);
    await b.agent.get("/api/tickets").expect(200);
  });
  it("logs out restricted sessions and permits a fresh anonymous login", async () => {
    const u = await user(), b = await browser();
    await b.post("login", { email: u.email, password: initial });
    expect((await b.post("logout")).status).toBe(204);
    await b.agent.get("/api/auth/me").expect(401);
    const fresh = await browser();
    expect((await fresh.post("login", { email: u.email, password: initial })).status).toBe(200);
  });
  it("checks CSRF and origin before mutation and rejects oversized/malformed bodies safely", async () => {
    const b = await browser(), u = await user();
    await b.agent.post("/api/auth/login").send({ email: u.email, password: initial }).expect(403);
    await b.agent.post("/api/auth/login").set("Origin", "https://other.example").set("X-CSRF-Token", b.csrf)
      .send({ email: u.email, password: initial }).expect(403);
    const login = await b.post("login", { email: u.email, password: initial });
    for (const path of ["change-password", "logout"]) await b.agent.post("/api/auth/" + path).send({}).expect(403);
    await b.agent.get("/api/auth/me").expect(200);
    const huge = await request(app).post("/api/auth/login").send({ password: "x".repeat(140_000) }).expect(413);
    expect(huge.body.code).toBe("PAYLOAD_TOO_LARGE");
    const malformed = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{").expect(400);
    expect(malformed.text).not.toMatch(/SyntaxError|stack|passwordHash/);
    expect(login.status).toBe(200);
  });
  it("expires idle/absolute/anonymous sessions and throttles repeated failures with a controlled clock", async () => {
    let time = new Date();
    const isolated = express(), auth = createAuth({ now: () => time, config: { origin, secure: false } });
    isolated.use(express.json(), auth.load); isolated.use("/api/auth", auth.router); isolated.use(authErrorHandler);
    const u = await user({ mustChangePassword: false });
    for (const delta of [IDLE_MS, ABSOLUTE_MS]) {
      const b = await browser(isolated), logged = await b.post("login", { email: u.email, password: initial });
      time = new Date(time.getTime() + delta);
      if (delta === ABSOLUTE_MS) {
        await db.session.update({ where: { tokenHash: tokenHash(cookie(logged).slice(COOKIE.length + 1)) }, data: { lastSeenAt: time } });
      }
      await request(isolated).get("/api/auth/me").set("Cookie", cookie(logged)).expect(401);
    }
    const b = await browser(isolated);
    for (let i = 0; i < 5; i++) expect((await b.post("login", { email: u.email, password: "wrong" })).status).toBe(401);
    const throttled = await b.post("login", { email: u.email, password: initial });
    expect(throttled.status).toBe(429); expect(Number(throttled.headers["retry-after"])).toBeGreaterThan(0);
    time = new Date(time.getTime() + 900_000);
    expect((await b.post("login", { email: u.email, password: initial })).status).toBe(403);
    const fresh = await browser(isolated);
    expect((await fresh.post("login", { email: u.email, password: initial })).status).toBe(200);
  });
  it("uses fresh account state and invalidates inactive sessions", async () => {
    const u = await user({ mustChangePassword: false }), b = await browser();
    await b.post("login", { email: u.email, password: initial });
    await db.user.update({ where: { id: u.id }, data: { role: "IT_STAFF" } });
    expect((await b.agent.get("/api/auth/me")).body.user.role).toBe("IT_STAFF");
    await db.user.update({ where: { id: u.id }, data: { isActive: false } });
    await b.agent.get("/api/auth/me").expect(401);
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
  });
});
