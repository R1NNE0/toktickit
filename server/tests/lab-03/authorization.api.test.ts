import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth/password.js";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import { requesterHeaders } from "./legacy-session.js";
// API-05/06/07: current Requester endpoints only. Future Staff/Admin APIs belong to P4–6.
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

describe("API-05/06/07 Requester role and resource authorization", () => {
  const db = getPrisma();
  async function fixtures() {
    const owner = await db.user.findUniqueOrThrow({ where: { email: "jennifer.anderson@example.com" } });
    const other = await db.user.findUniqueOrThrow({ where: { email: "michael.brown@example.com" } });
    const ticket = await db.ticket.findUniqueOrThrow({ where: { ticketNumber: "TKT-2026-000101" } });
    const attachment = await db.attachment.findFirstOrThrow({ where: { ticketId: ticket.id } });
    return { owner, other, ticket, attachment };
  }
  it("ignores spoofed headers but rejects body/query identity overrides without creating records", async () => {
    const { owner, other, ticket } = await fixtures(), headers = await requesterHeaders(owner.id);
    const payload = { summary: "Session identity", description: "Owned by session", categoryId: ticket.categoryId, relatedSystemId: ticket.relatedSystemId };
    const created = await request(app).post("/api/tickets").set(headers).set("x-requester-id", String(other.id)).send(payload).expect(201);
    expect(created.body.requesterId).toBe(owner.id);
    const list = await request(app).get("/api/tickets").set(headers).set("x-requester-id", String(other.id)).expect(200);
    expect(list.body.data.every((row: { requesterId: number }) => row.requesterId === owner.id)).toBe(true);
    const count = await db.ticket.count();
    for (const field of ["requesterId", "authorId", "createdAt", "itPriority", "currentStatus", "ownerId", "passwordHash"]) {
      await request(app).post("/api/tickets").set(headers).send({ ...payload, [field]: other.id }).expect(400);
    }
    for (const url of ["/api/tickets", `/api/tickets/${ticket.id}`])
      await request(app).get(url + "?requesterId=" + other.id).set(headers).expect(400);
    await request(app).post("/api/tickets?requesterId=" + other.id).set(headers).send(payload).expect(400);
    expect(await db.ticket.count()).toBe(count);
    await request(app).get("/api/requesters/active").set(headers).expect(404);
  });
  it("returns indistinguishable not-found responses for cross-requester and absent resources before writing bytes", async () => {
    const { other, ticket, attachment } = await fixtures(), headers = await requesterHeaders(other.id);
    const before = await readdir(process.env.TEST_UPLOAD_ROOT!);
    for (const [method, existing, missing] of [
      ["get", `/api/tickets/${ticket.id}`, "/api/tickets/2147483647"],
      ["get", `/api/attachments/${attachment.id}/download`, "/api/attachments/2147483647/download"],
      ["delete", `/api/attachments/${attachment.id}`, "/api/attachments/2147483647"],
    ] as const) {
      const a = await request(app)[method](existing).set(headers).send({ reason: "" }).expect(404);
      const b = await request(app)[method](missing).set(headers).send({ reason: "" }).expect(404);
      expect(a.body).toEqual(b.body); expect(a.body.code).toBe("NOT_FOUND");
    }
    const upload = (id: number) => request(app).post(`/api/tickets/${id}/attachments`).set(headers)
      .attach("file", Buffer.from("%PDF-1.4 private"), "private.pdf");
    const a = await upload(ticket.id).expect(404), b = await upload(2147483647).expect(404);
    expect(a.body).toEqual(b.body);
    expect(await readdir(process.env.TEST_UPLOAD_ROOT!)).toEqual(before);
  });
  it.each(["IT_STAFF", "ADMINISTRATOR"] as const)("denies %s Requester-only list and create operations", async role => {
    const user = await db.user.findFirstOrThrow({ where: { role, isActive: true } });
    const headers = await requesterHeaders(user.id);
    for (const [method, url] of [["get", "/api/tickets"], ["post", "/api/tickets"]] as const) {
      const denied = await request(app)[method](url).set(headers).send({}).expect(403);
      expect(denied.body.code).toBe("FORBIDDEN");
    }
  });
  it("denies ADMINISTRATOR attachment file operations regardless of ticket existence", async () => {
    const user = await db.user.findFirstOrThrow({ where: { role: "ADMINISTRATOR", isActive: true } });
    const headers = await requesterHeaders(user.id), { ticket, attachment } = await fixtures();
    for (const id of [ticket.id, 2147483647]) {
      for (const [method, url] of [
        ["post", `/api/tickets/${id}/attachments`],
        ["get", `/api/attachments/${id === ticket.id ? attachment.id : id}/download`],
        ["delete", `/api/attachments/${id === ticket.id ? attachment.id : id}`]
      ] as const) {
        const denied = await request(app)[method](url).set(headers).send({}).expect(403);
        expect(denied.body.code).toBe("FORBIDDEN");
      }
    }
  });
  it.each(["inactive", "revoked", "expired"])("rejects %s sessions on all Requester operations", async state => {
    const email = randomUUID() + "@example.com";
    const user = await db.user.create({ data: { name: "Session state", email, emailNormalized: email,
      passwordHash: await hashPassword("Synthetic session fixture only!"), mustChangePassword: false } });
    const headers = await requesterHeaders(user.id);
    if (state === "inactive") await db.user.update({ where: { id: user.id }, data: { isActive: false } });
    if (state === "revoked") await db.session.deleteMany({ where: { userId: user.id } });
    if (state === "expired") await db.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(0) } });
    for (const [method, url] of [["get", "/api/tickets"], ["post", "/api/tickets"], ["get", "/api/tickets/1"],
      ["post", "/api/tickets/1/attachments"], ["get", "/api/attachments/1/download"], ["delete", "/api/attachments/1"]] as const) {
      const denied = await request(app)[method](url).set(headers).send({}).expect(401);
      expect(denied.body.code).toBe("UNAUTHENTICATED");
    }
  });
});

describe("API-26 Administrator capability view and authorization matrix", () => {
  const db = getPrisma();
  async function adminFixtures() {
    const admin = await db.user.findFirstOrThrow({ where: { role: "ADMINISTRATOR", isActive: true } });
    const staff = await db.user.findFirstOrThrow({ where: { role: "IT_STAFF", isActive: true } });
    const requester = await db.user.findFirstOrThrow({ where: { role: "REQUESTER", isActive: true } });
    const ticket = await db.ticket.findFirstOrThrow({ where: { currentStatus: { not: "CANCELLED" } } });
    const headers = await requesterHeaders(admin.id);
    return { admin, staff, requester, ticket, headers };
  }

  it("permits Administrator to read ticket detail, attachment metadata, comments, and notes", async () => {
    const { ticket, headers } = await adminFixtures();
    // Detail read via GET /api/tickets/:id
    const detail = await request(app).get(`/api/tickets/${ticket.id}`).set(headers).expect(200);
    expect(detail.body.id).toBe(ticket.id);
    expect(Array.isArray(detail.body.attachments)).toBe(true);
    expect(detail.body.attachments.every((a: any) => typeof a.storedPath === "undefined")).toBe(true);

    // Comments read via GET /api/tickets/:id/comments
    const comments = await request(app).get(`/api/tickets/${ticket.id}/comments`).set(headers).expect(200);
    expect(Array.isArray(comments.body.data)).toBe(true);

    // Notes read via GET /api/tickets/:id/notes
    const notes = await request(app).get(`/api/tickets/${ticket.id}/notes`).set(headers).expect(200);
    expect(Array.isArray(notes.body.data)).toBe(true);
  });

  it("permits Administrator to update IT Priority without modifying requestedPriority", async () => {
    const { ticket, headers } = await adminFixtures();
    const originalRequested = ticket.requestedPriority;
    const targetItPriority = ticket.itPriority === "CRITICAL" ? "LOW" : "CRITICAL";

    const updated = await request(app)
      .patch(`/api/staff/tickets/${ticket.id}/priority`)
      .set(headers)
      .send({ itPriority: targetItPriority })
      .expect(200);

    expect(updated.body.itPriority).toBe(targetItPriority);
    expect(updated.body.requestedPriority).toBe(originalRequested);

    // Verify in database
    const inDb = await db.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(inDb.itPriority).toBe(targetItPriority);
    expect(inDb.requestedPriority).toBe(originalRequested);
  });

  it("denies Administrator all operational staff mutations and posting operations", async () => {
    const { ticket, headers } = await adminFixtures();

    // Staff queue
    await request(app).get("/api/staff/tickets").set(headers).expect(403);
    // Assignees lookup
    await request(app).get("/api/staff/assignees").set(headers).expect(403);
    // Staff ticket detail alias
    await request(app).get(`/api/staff/tickets/${ticket.id}`).set(headers).expect(403);
    // Claim
    await request(app).post(`/api/staff/tickets/${ticket.id}/claim`).set(headers).send({}).expect(403);
    // Reassign
    await request(app).patch(`/api/staff/tickets/${ticket.id}/owner`).set(headers).send({ ownerId: null }).expect(403);
    // Status change
    await request(app).patch(`/api/staff/tickets/${ticket.id}/status`).set(headers).send({ currentStatus: "IN_PROGRESS" }).expect(403);
    // Public comment post
    await request(app).post(`/api/tickets/${ticket.id}/comments`).set(headers).send({ body: "Admin comment" }).expect(403);
    // Internal note post
    await request(app).post(`/api/tickets/${ticket.id}/notes`).set(headers).send({ body: "Admin note" }).expect(403);
    // Resolution indication
    await request(app).post(`/api/tickets/${ticket.id}/resolution-indication`).set(headers).send({}).expect(403);
    // Attachment operations
    await request(app).post(`/api/tickets/${ticket.id}/attachments`).set(headers).attach("file", Buffer.from("%PDF-1.4 admin"), "admin.pdf").expect(403);
  });
});
