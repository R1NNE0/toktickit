import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { requesterHeaders } from "./legacy-session.js";

describe("API-17 Public Comments & API-18 Internal Notes", () => {
  const db = getPrisma();
  const marker = "comm-" + randomUUID();
  let staffHeaders: Record<string, string>;
  let adminHeaders: Record<string, string>;
  let requesterHeadersMap: Record<string, string>;
  let otherRequesterHeaders: Record<string, string>;

  let staffId: number;
  let adminId: number;
  let requesterId: number;
  let otherRequesterId: number;
  let categoryId: number;
  let systemId: number;
  let testTicketId: number;

  beforeAll(async () => {
    const staff = await db.user.findFirstOrThrow({ where: { role: "IT_STAFF", isActive: true } });
    staffId = staff.id;
    staffHeaders = await requesterHeaders(staffId);

    const admin = await db.user.findFirstOrThrow({ where: { role: "ADMINISTRATOR", isActive: true } });
    adminId = admin.id;
    adminHeaders = await requesterHeaders(adminId);

    const requesters = await db.user.findMany({ where: { role: "REQUESTER", isActive: true }, take: 2 });
    requesterId = requesters[0].id;
    requesterHeadersMap = await requesterHeaders(requesterId);
    otherRequesterId = requesters[1].id;
    otherRequesterHeaders = await requesterHeaders(otherRequesterId);

    const cat = await db.category.findFirstOrThrow({ where: { isActive: true } });
    categoryId = cat.id;
    const sys = await db.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
    systemId = sys.id;

    const ticket = await db.ticket.create({
      data: {
        ticketNumber: marker + "-01",
        summary: "Comment test ticket",
        description: "Testing public discussion entries",
        requesterId,
        categoryId,
        relatedSystemId: systemId,
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: "OPEN",
        ownerId: staffId,
      },
    });
    testTicketId = ticket.id;
  });

  afterAll(async () => {
    await db.publicComment.deleteMany({ where: { ticket: { ticketNumber: { startsWith: marker } } } });
    await db.internalNote.deleteMany({ where: { ticket: { ticketNumber: { startsWith: marker } } } });
    await db.ticket.deleteMany({ where: { ticketNumber: { startsWith: marker } } });
  });

  describe("API-17 Public Comments", () => {
    it("allows Requester and IT Staff to post public comments, and sets server author and timestamp", async () => {
      // Requester posts comment
      const res1 = await request(app)
        .post(`/api/tickets/${testTicketId}/comments`)
        .set(requesterHeadersMap)
        .send({ body: "Hello, this is requester comment." })
        .expect(201);

      expect(res1.body.ticketId).toBe(testTicketId);
      expect(res1.body.body).toBe("Hello, this is requester comment.");
      expect(res1.body.author.id).toBe(requesterId);
      expect(res1.body.createdAt).toBeTruthy();

      // IT Staff posts comment
      const res2 = await request(app)
        .post(`/api/tickets/${testTicketId}/comments`)
        .set(staffHeaders)
        .send({ body: "Hello, this is staff response." })
        .expect(201);

      expect(res2.body.ticketId).toBe(testTicketId);
      expect(res2.body.body).toBe("Hello, this is staff response.");
      expect(res2.body.author.id).toBe(staffId);
      expect(res2.body.createdAt).toBeTruthy();
    });

    it("allows Requester, Staff, and Administrator to read public comments in chronological order with pagination", async () => {
      // Read by Requester
      const resR = await request(app)
        .get(`/api/tickets/${testTicketId}/comments`)
        .set(requesterHeadersMap)
        .expect(200);

      expect(Array.isArray(resR.body.data)).toBe(true);
      expect(resR.body.data.length).toBeGreaterThanOrEqual(2);
      expect(resR.body.pagination).toBeDefined();
      expect(resR.body.pagination.totalItems).toBeGreaterThanOrEqual(2);

      // Verify chronological order (createdAt asc, id asc)
      for (let i = 1; i < resR.body.data.length; i++) {
        const prev = resR.body.data[i - 1];
        const curr = resR.body.data[i];
        expect(new Date(prev.createdAt).getTime() <= new Date(curr.createdAt).getTime()).toBe(true);
      }

      // Read by Staff
      const resS = await request(app)
        .get(`/api/tickets/${testTicketId}/comments`)
        .set(staffHeaders)
        .expect(200);
      expect(resS.body.data.length).toBe(resR.body.data.length);

      // Read by Admin
      const resA = await request(app)
        .get(`/api/tickets/${testTicketId}/comments`)
        .set(adminHeaders)
        .expect(200);
      expect(resA.body.data.length).toBe(resR.body.data.length);
    });

    it("denies Administrator from posting public comments with 403", async () => {
      await request(app)
        .post(`/api/tickets/${testTicketId}/comments`)
        .set(adminHeaders)
        .send({ body: "Admin attempting to comment" })
        .expect(403);
    });

    it("denies other Requesters from reading or posting comments on tickets they do not own (404)", async () => {
      // Read
      await request(app)
        .get(`/api/tickets/${testTicketId}/comments`)
        .set(otherRequesterHeaders)
        .expect(404);

      // Post
      await request(app)
        .post(`/api/tickets/${testTicketId}/comments`)
        .set(otherRequesterHeaders)
        .send({ body: "Sneaky comment" })
        .expect(404);
    });

    it("validates body boundaries (1–4000 characters) and trims whitespace", async () => {
      // Empty body
      await request(app)
        .post(`/api/tickets/${testTicketId}/comments`)
        .set(staffHeaders)
        .send({ body: "   " })
        .expect(400);

      // Missing body
      await request(app)
        .post(`/api/tickets/${testTicketId}/comments`)
        .set(staffHeaders)
        .send({})
        .expect(400);

      // Oversized body (>4000 chars)
      await request(app)
        .post(`/api/tickets/${testTicketId}/comments`)
        .set(staffHeaders)
        .send({ body: "x".repeat(4001) })
        .expect(400);

      // Valid boundary 4000 chars
      const res = await request(app)
        .post(`/api/tickets/${testTicketId}/comments`)
        .set(staffHeaders)
        .send({ body: "y".repeat(4000) })
        .expect(201);
      expect(res.body.body.length).toBe(4000);
    });

    it("does not allow PATCH or DELETE on comments (404)", async () => {
      await request(app).patch(`/api/tickets/${testTicketId}/comments/1`).set(staffHeaders).send({ body: "edit" }).expect(404);
      await request(app).delete(`/api/tickets/${testTicketId}/comments/1`).set(staffHeaders).send({}).expect(404);
    });
  });

  describe("API-18 Internal Notes", () => {
    it("allows IT Staff to create and read internal notes", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicketId}/notes`)
        .set(staffHeaders)
        .send({ body: "Internal triage note: hardware suspect." })
        .expect(201);

      expect(res.body.ticketId).toBe(testTicketId);
      expect(res.body.body).toBe("Internal triage note: hardware suspect.");
      expect(res.body.author.id).toBe(staffId);
      expect(res.body.createdAt).toBeTruthy();

      // Read by Staff
      const listRes = await request(app)
        .get(`/api/tickets/${testTicketId}/notes`)
        .set(staffHeaders)
        .expect(200);

      expect(Array.isArray(listRes.body.data)).toBe(true);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(listRes.body.data.some((n: any) => n.body === "Internal triage note: hardware suspect.")).toBe(true);
    });

    it("allows Administrator to read internal notes but denies creation (403)", async () => {
      // Read by Admin succeeds
      const listRes = await request(app)
        .get(`/api/tickets/${testTicketId}/notes`)
        .set(adminHeaders)
        .expect(200);

      expect(Array.isArray(listRes.body.data)).toBe(true);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

      // Create by Admin fails with 403
      await request(app)
        .post(`/api/tickets/${testTicketId}/notes`)
        .set(adminHeaders)
        .send({ body: "Admin note attempt" })
        .expect(403);
    });

    it("strictly denies Requesters from reading or creating internal notes with 403 before lookup", async () => {
      // Read on own ticket -> 403
      const getOwn = await request(app)
        .get(`/api/tickets/${testTicketId}/notes`)
        .set(requesterHeadersMap)
        .expect(403);
      expect(getOwn.body.code).toBe("FORBIDDEN");

      // Read on non-existent ticket -> 403 (before lookup!)
      const getMissing = await request(app)
        .get("/api/tickets/2147483647/notes")
        .set(requesterHeadersMap)
        .expect(403);
      expect(getMissing.body.code).toBe("FORBIDDEN");

      // Post on own ticket -> 403
      const postOwn = await request(app)
        .post(`/api/tickets/${testTicketId}/notes`)
        .set(requesterHeadersMap)
        .send({ body: "Requester trying to note" })
        .expect(403);
      expect(postOwn.body.code).toBe("FORBIDDEN");
    });

    it("guarantees zero note leakage in Requester detail DTO and public comments", async () => {
      const detailRes = await request(app)
        .get(`/api/tickets/${testTicketId}`)
        .set(requesterHeadersMap)
        .expect(200);

      expect(detailRes.body).not.toHaveProperty("internalNotes");
      expect(detailRes.body).not.toHaveProperty("notes");
      expect(detailRes.body).not.toHaveProperty("noteCount");
      const detailJson = JSON.stringify(detailRes.body);
      expect(detailJson).not.toMatch(/internalNotes|noteCount/i);

      const commentsRes = await request(app)
        .get(`/api/tickets/${testTicketId}/comments`)
        .set(requesterHeadersMap)
        .expect(200);

      const commentsJson = JSON.stringify(commentsRes.body);
      expect(commentsJson).not.toMatch(/internalNotes|hardware suspect/i);
    });

    it("does not allow PATCH or DELETE on notes (404)", async () => {
      await request(app).patch(`/api/tickets/${testTicketId}/notes/1`).set(staffHeaders).send({ body: "edit" }).expect(404);
      await request(app).delete(`/api/tickets/${testTicketId}/notes/1`).set(staffHeaders).send({}).expect(404);
    });
  });
});
