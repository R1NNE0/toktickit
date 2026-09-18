import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import type { Prisma } from "@prisma/client";
import { requesterHeaders } from "./legacy-session.js";

describe("API-14, API-15, API-16, API-19 Staff Ticket Detail, Workflow & Resolution Indication", () => {
  const db = getPrisma();
  const marker = "detail-" + randomUUID();
  let staffHeaders: Record<string, string>;
  let staff2Headers: Record<string, string>;
  let adminHeaders: Record<string, string>;
  let requesterHeadersMap: Record<string, string>;
  let otherRequesterHeaders: Record<string, string>;

  let staffId: number;
  let staff2Id: number;
  let adminId: number;
  let requesterId: number;
  let otherRequesterId: number;
  let inactiveStaffId: number;
  let categoryId: number;
  let systemId: number;

  beforeAll(async () => {
    const staff = await db.user.findFirstOrThrow({ where: { role: "IT_STAFF", isActive: true } });
    staffId = staff.id;
    staffHeaders = await requesterHeaders(staffId);

    // Create a second active IT Staff for assignment/claim tests
    const staff2Email = "staff2-" + marker + "@example.com";
    const staff2 = await db.user.create({
      data: {
        name: "Second Staff",
        email: staff2Email,
        emailNormalized: staff2Email.toLowerCase(),
        role: "IT_STAFF",
        isActive: true,
        passwordHash: staff.passwordHash,
        mustChangePassword: false,
      },
    });
    staff2Id = staff2.id;
    staff2Headers = await requesterHeaders(staff2Id);

    // Inactive staff
    const inactiveEmail = "inactive-" + marker + "@example.com";
    const inactiveStaff = await db.user.create({
      data: {
        name: "Inactive Staff",
        email: inactiveEmail,
        emailNormalized: inactiveEmail.toLowerCase(),
        role: "IT_STAFF",
        isActive: false,
        passwordHash: staff.passwordHash,
        mustChangePassword: false,
      },
    });
    inactiveStaffId = inactiveStaff.id;

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
  });

  afterAll(async () => {
    await db.publicComment.deleteMany({ where: { ticket: { ticketNumber: { startsWith: marker } } } });
    await db.internalNote.deleteMany({ where: { ticket: { ticketNumber: { startsWith: marker } } } });
    await db.attachment.deleteMany({ where: { ticket: { ticketNumber: { startsWith: marker } } } });
    await db.ticket.deleteMany({ where: { ticketNumber: { startsWith: marker } } });
    await db.session.deleteMany({ where: { userId: { in: [staff2Id, inactiveStaffId] } } });
    await db.user.deleteMany({ where: { id: { in: [staff2Id, inactiveStaffId] } } });
  });

  async function createTestTicket(overrides: Partial<Prisma.TicketUncheckedCreateInput> = {}) {
    const data: Prisma.TicketUncheckedCreateInput = {
      ticketNumber: marker + "-" + randomUUID().slice(0, 8),
      summary: "Test workflow ticket",
      description: "Test description for workflow",
      requesterId,
      categoryId,
      relatedSystemId: systemId,
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: "NEW",
      ...overrides,
    };
    return db.ticket.create({
      data,
      include: {
        category: true,
        relatedSystem: true,
        requester: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, name: true, role: true, isActive: true } },
      },
    });
  }

  describe("API-14 Assignees, Detail, Claim & Reassignment", () => {
    it("returns active IT_STAFF and ADMINISTRATOR assignees sorted by name then id", async () => {
      const res = await request(app)
        .get("/api/staff/assignees")
        .set(staffHeaders)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      for (const assignee of res.body) {
        expect(["IT_STAFF", "ADMINISTRATOR"]).toContain(assignee.role);
        expect(assignee.isActive).toBe(true);
        expect(assignee).toHaveProperty("id");
        expect(assignee).toHaveProperty("name");
      }
      // Verify sorting
      for (let i = 1; i < res.body.length; i++) {
        const prev = res.body[i - 1];
        const curr = res.body[i];
        const cmp = prev.name.localeCompare(curr.name);
        expect(cmp <= 0).toBe(true);
        if (cmp === 0) {
          expect(prev.id < curr.id).toBe(true);
        }
      }
      // Requesters & Admins denied
      await request(app).get("/api/staff/assignees").set(requesterHeadersMap).expect(403);
      await request(app).get("/api/staff/assignees").set(adminHeaders).expect(403);
    });

    it("returns staff ticket detail with safe references and attachment count", async () => {
      const ticket = await createTestTicket();
      const res = await request(app)
        .get(`/api/staff/tickets/${ticket.id}`)
        .set(staffHeaders)
        .expect(200);

      expect(res.body.id).toBe(ticket.id);
      expect(res.body.ticketNumber).toBe(ticket.ticketNumber);
      expect(res.body.requester.id).toBe(requesterId);
      expect(res.body.owner).toBeNull();
      expect(res.body.attachmentCount).toBe(0);

      // Requesters & Admins denied on staff detail alias
      await request(app).get(`/api/staff/tickets/${ticket.id}`).set(requesterHeadersMap).expect(403);
      await request(app).get(`/api/staff/tickets/${ticket.id}`).set(adminHeaders).expect(403);
    });

    it("allows IT Staff to claim an unassigned ticket", async () => {
      const ticket = await createTestTicket({ ownerId: null });
      const res = await request(app)
        .post(`/api/staff/tickets/${ticket.id}/claim`)
        .set(staffHeaders)
        .send({})
        .expect(200);

      expect(res.body.ownerId).toBe(staffId);
      expect(res.body.owner.id).toBe(staffId);
    });

    it("rejects claim with 409 ALREADY_ASSIGNED when ticket is already assigned", async () => {
      const ticket = await createTestTicket({ ownerId: staffId });
      const res = await request(app)
        .post(`/api/staff/tickets/${ticket.id}/claim`)
        .set(staff2Headers)
        .send({})
        .expect(409);

      expect(res.body.code).toBe("ALREADY_ASSIGNED");
    });

    it("handles concurrent claims safely with exactly one winner", async () => {
      const ticket = await createTestTicket({ ownerId: null });
      const [res1, res2] = await Promise.all([
        request(app).post(`/api/staff/tickets/${ticket.id}/claim`).set(staffHeaders).send({}),
        request(app).post(`/api/staff/tickets/${ticket.id}/claim`).set(staff2Headers).send({}),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);
    });

    it("allows IT Staff to reassign ticket to another eligible staff, admin, or null", async () => {
      const ticket = await createTestTicket({ ownerId: staffId });

      // Assign to staff2
      const res1 = await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/owner`)
        .set(staffHeaders)
        .send({ ownerId: staff2Id })
        .expect(200);
      expect(res1.body.ownerId).toBe(staff2Id);

      // Assign to admin
      const res2 = await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/owner`)
        .set(staffHeaders)
        .send({ ownerId: adminId })
        .expect(200);
      expect(res2.body.ownerId).toBe(adminId);

      // Unassign (null)
      const res3 = await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/owner`)
        .set(staffHeaders)
        .send({ ownerId: null })
        .expect(200);
      expect(res3.body.ownerId).toBeNull();
      expect(res3.body.owner).toBeNull();
    });

    it("rejects assigning ticket to inactive user, requester, or non-existent user", async () => {
      const ticket = await createTestTicket();

      // Inactive staff
      await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/owner`)
        .set(staffHeaders)
        .send({ ownerId: inactiveStaffId })
        .expect(400);

      // Requester
      await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/owner`)
        .set(staffHeaders)
        .send({ ownerId: requesterId })
        .expect(400);

      // Non-existent ID
      await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/owner`)
        .set(staffHeaders)
        .send({ ownerId: 2147483647 })
        .expect(400);

      // Invalid ID types
      await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/owner`)
        .set(staffHeaders)
        .send({ ownerId: -5 })
        .expect(400);
    });
  });

  describe("API-15 Priority Updates by Staff and Administrator", () => {
    it("permits both Staff and Administrator to update itPriority without altering requestedPriority", async () => {
      const ticket = await createTestTicket({ requestedPriority: "LOW", itPriority: "LOW" });

      // Staff updates to HIGH
      const res1 = await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/priority`)
        .set(staffHeaders)
        .send({ itPriority: "HIGH" })
        .expect(200);
      expect(res1.body.itPriority).toBe("HIGH");
      expect(res1.body.requestedPriority).toBe("LOW");

      // Admin updates to CRITICAL
      const res2 = await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/priority`)
        .set(adminHeaders)
        .send({ itPriority: "CRITICAL" })
        .expect(200);
      expect(res2.body.itPriority).toBe("CRITICAL");
      expect(res2.body.requestedPriority).toBe("LOW");
    });

    it("rejects invalid priority and denies Requester", async () => {
      const ticket = await createTestTicket();

      // Invalid priority
      await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/priority`)
        .set(staffHeaders)
        .send({ itPriority: "SUPER_URGENT" })
        .expect(400);

      // Requester denied
      await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/priority`)
        .set(requesterHeadersMap)
        .send({ itPriority: "HIGH" })
        .expect(403);
    });
  });

  describe("API-16 Status Transitions & Validations", () => {
    it("enforces owner requirement when transitioning from OPEN to IN_PROGRESS", async () => {
      // Unassigned ticket cannot transition to IN_PROGRESS
      const ticket = await createTestTicket({ currentStatus: "OPEN", ownerId: null });
      const errRes = await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/status`)
        .set(staffHeaders)
        .send({ currentStatus: "IN_PROGRESS" })
        .expect(409);
      expect(errRes.body.code).toBe("CONFLICT");

      // Assign owner then transition to IN_PROGRESS
      await db.ticket.update({ where: { id: ticket.id }, data: { ownerId: staffId } });
      const okRes = await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/status`)
        .set(staffHeaders)
        .send({ currentStatus: "IN_PROGRESS" })
        .expect(200);
      expect(okRes.body.currentStatus).toBe("IN_PROGRESS");
    });

    it("requires confirmation and reason when cancelling ticket, creating public comment atomically", async () => {
      const ticket = await createTestTicket({ currentStatus: "NEW" });

      // Missing confirmation
      await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/status`)
        .set(staffHeaders)
        .send({ currentStatus: "CANCELLED", reason: "Duplicate ticket reported." })
        .expect(400);

      // Missing reason
      await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/status`)
        .set(staffHeaders)
        .send({ currentStatus: "CANCELLED", confirmed: true, reason: "" })
        .expect(400);

      // Valid cancellation
      const cancelReason = "Ticket cancelled as requested by requester.";
      const res = await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/status`)
        .set(staffHeaders)
        .send({ currentStatus: "CANCELLED", confirmed: true, reason: cancelReason })
        .expect(200);
      expect(res.body.currentStatus).toBe("CANCELLED");

      // Verify reason was created as a public comment
      const comment = await db.publicComment.findFirst({
        where: { ticketId: ticket.id, body: cancelReason },
      });
      expect(comment).not.toBeNull();
      expect(comment?.authorId).toBe(staffId);
    });

    it("requires confirmation and reason when reopening ticket, and clears resolution suggestion", async () => {
      const now = new Date();
      const ticket = await createTestTicket({
        currentStatus: "RESOLVED",
        ownerId: staffId,
        resolutionSuggestedAt: now,
        resolutionSuggestedById: requesterId,
      });

      const reopenReason = "Issue resurfaced after firmware reboot.";
      const res = await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/status`)
        .set(staffHeaders)
        .send({ currentStatus: "REOPENED", confirmed: true, reason: reopenReason })
        .expect(200);

      expect(res.body.currentStatus).toBe("REOPENED");
      expect(res.body.resolutionSuggestedAt).toBeNull();
      expect(res.body.resolutionSuggestedById).toBeNull();

      // Check DB
      const dbTicket = await db.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(dbTicket.currentStatus).toBe("REOPENED");
      expect(dbTicket.resolutionSuggestedAt).toBeNull();
      expect(dbTicket.resolutionSuggestedById).toBeNull();

      // Check public comment created
      const comment = await db.publicComment.findFirst({
        where: { ticketId: ticket.id, body: reopenReason },
      });
      expect(comment).not.toBeNull();
      expect(comment?.authorId).toBe(staffId);
    });

    it("rejects invalid transitions and self-transitions with 409", async () => {
      const ticket = await createTestTicket({ currentStatus: "NEW" });

      // Self transition
      await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/status`)
        .set(staffHeaders)
        .send({ currentStatus: "NEW" })
        .expect(409);

      // Illegal transition (NEW -> CLOSED)
      await request(app)
        .patch(`/api/staff/tickets/${ticket.id}/status`)
        .set(staffHeaders)
        .send({ currentStatus: "CLOSED" })
        .expect(409);
    });
  });

  describe("API-19 Requester Resolution Indication", () => {
    it("allows ticket owner Requester to indicate resolution on active ticket", async () => {
      const ticket = await createTestTicket({ currentStatus: "IN_PROGRESS", ownerId: staffId });

      const res = await request(app)
        .post(`/api/tickets/${ticket.id}/resolution-indication`)
        .set(requesterHeadersMap)
        .send({})
        .expect(200);

      expect(res.body.ticketId).toBe(ticket.id);
      expect(res.body.currentStatus).toBe("IN_PROGRESS");
      expect(res.body.resolutionSuggestedAt).toBeTruthy();
      expect(res.body.resolutionSuggestedById).toBe(requesterId);
    });

    it("is idempotent when repeated within the same active cycle", async () => {
      const ticket = await createTestTicket({ currentStatus: "IN_PROGRESS", ownerId: staffId });

      const res1 = await request(app)
        .post(`/api/tickets/${ticket.id}/resolution-indication`)
        .set(requesterHeadersMap)
        .send({})
        .expect(200);

      const firstTimestamp = res1.body.resolutionSuggestedAt;

      const res2 = await request(app)
        .post(`/api/tickets/${ticket.id}/resolution-indication`)
        .set(requesterHeadersMap)
        .send({})
        .expect(200);

      expect(res2.body.resolutionSuggestedAt).toBe(firstTimestamp);
    });

    it("rejects resolution indication on terminal statuses with 409", async () => {
      for (const terminalStatus of ["RESOLVED", "CLOSED", "CANCELLED"] as const) {
        const ticket = await createTestTicket({ currentStatus: terminalStatus });
        const res = await request(app)
          .post(`/api/tickets/${ticket.id}/resolution-indication`)
          .set(requesterHeadersMap)
          .send({})
          .expect(409);
        expect(res.body.code).toBe("CONFLICT");
      }
    });

    it("denies other Requesters with 404 and Staff/Admin with 403", async () => {
      const ticket = await createTestTicket({ currentStatus: "IN_PROGRESS" });

      // Other Requester gets 404
      await request(app)
        .post(`/api/tickets/${ticket.id}/resolution-indication`)
        .set(otherRequesterHeaders)
        .send({})
        .expect(404);

      // Staff gets 403
      await request(app)
        .post(`/api/tickets/${ticket.id}/resolution-indication`)
        .set(staffHeaders)
        .send({})
        .expect(403);

      // Admin gets 403
      await request(app)
        .post(`/api/tickets/${ticket.id}/resolution-indication`)
        .set(adminHeaders)
        .send({})
        .expect(403);
    });
  });
});
