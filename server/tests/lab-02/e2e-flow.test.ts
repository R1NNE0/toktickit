import { requesterHeaders } from "../lab-03/legacy-session.js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Lab 2 (Issue #7) - Complete Requester End-to-End Integration Flow (E2E-01)", () => {
  const prisma = getPrisma();

  let jenniferId: number;
  let michaelId: number;
  let softwareCategoryId: number;
  let emailSystemId: number;

  let createdTicketId: number;
  let createdTicketNumber: string;
  let idempotencyKey: string;
  let attachmentId: number;
  let tempUploadPath: string;

  beforeAll(async () => {
    // 1. Discover seeded requesters
    const jennifer = await prisma.user.findUnique({
      where: { email: "jennifer.anderson@example.com" },
    });
    const michael = await prisma.user.findUnique({
      where: { email: "michael.brown@example.com" },
    });

    expect(jennifer).not.toBeNull();
    expect(michael).not.toBeNull();
    jenniferId = jennifer!.id;
    michaelId = michael!.id;

    // 2. Discover active category and related system
    const category = await prisma.category.findFirst({
      where: { isActive: true },
    });
    const system = await prisma.relatedSystem.findFirst({
      where: { isActive: true },
    });

    expect(category).not.toBeNull();
    expect(system).not.toBeNull();
    softwareCategoryId = category!.id;
    emailSystemId = system!.id;

    // 3. Prepare temporary attachment file
    const uploadDir = path.resolve(process.cwd(), process.env.TEST_UPLOAD_ROOT!);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    tempUploadPath = path.join(uploadDir, `e2e-source-${Date.now()}.pdf`);
    fs.writeFileSync(
      tempUploadPath,
      "%PDF-1.4 End-to-End Diagnostics Test Content for TokTickIT Lab 2"
    );

    idempotencyKey = crypto.randomUUID();
  });

  afterAll(async () => {
    // Clean up temporary local test source file
    if (fs.existsSync(tempUploadPath)) {
      try {
        fs.unlinkSync(tempUploadPath);
      } catch {
        // ignore cleanup error
      }
    }
  });

  // -------------------------------------------------------------------------
  // Step 1: Current authenticated identity (Lab 3 session bridge)
  // -------------------------------------------------------------------------
  it("Step 1: retrieves the current session identity without persona discovery", async () => {
    const res = await request(app).get("/api/auth/me").set(await requesterHeaders(jenniferId));
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(jenniferId);
    expect(res.body.user.name).toBe("Jennifer Anderson");
    expect(res.body.user.isActive).toBe(true);
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  // -------------------------------------------------------------------------
  // Step 2: Ticket Creation with Idempotency & Auto-Sequencing (API-01 / AC-01)
  // -------------------------------------------------------------------------
  it("Step 2: creates a new ticket with valid payload, sequence number, and status NEW (API-01 / AC-01)", async () => {
    const payload = {
      summary: "E2E Flow Test - Critical VPN Gateway Failure",
      description:
        "Comprehensive end-to-end integration test validating the entire ticket lifecycle in Lab 2.",
      categoryId: softwareCategoryId,
      relatedSystemId: emailSystemId,
      requestedPriority: "HIGH",
      idempotencyKey,
    };

    const res = await request(app)
      .post("/api/tickets")
      .set(await requesterHeaders(jenniferId))
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("ticketNumber");
    expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.currentStatus).toBe("NEW");
    expect(res.body.requestedPriority).toBe("HIGH");
    expect(res.body.requesterId).toBe(jenniferId);

    createdTicketId = res.body.id;
    createdTicketNumber = res.body.ticketNumber;
  });

  it("Step 2b: safely replays identical ticket on duplicate submission (Idempotency / AC-01)", async () => {
    const payload = {
      summary: "E2E Flow Test - Critical VPN Gateway Failure",
      description:
        "Comprehensive end-to-end integration test validating the entire ticket lifecycle in Lab 2.",
      categoryId: softwareCategoryId,
      relatedSystemId: emailSystemId,
      requestedPriority: "HIGH",
      idempotencyKey,
    };

    const res = await request(app)
      .post("/api/tickets")
      .set(await requesterHeaders(jenniferId))
      .send(payload);

    // Should return 200 OK with existing ticket without creating a new duplicate
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdTicketId);
    expect(res.body.ticketNumber).toBe(createdTicketNumber);
  });

  // -------------------------------------------------------------------------
  // Step 3: Attachment Upload (API-08 / AC-07)
  // -------------------------------------------------------------------------
  it("Step 3: uploads a diagnostics attachment to the newly created ticket (API-08 / AC-07)", async () => {
    const res = await request(app)
      .post(`/api/tickets/${createdTicketId}/attachments`)
      .set(await requesterHeaders(jenniferId))
      .attach("file", tempUploadPath, "e2e-diagnostics.pdf");

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.ticketId).toBe(createdTicketId);
    expect(res.body.fileName).toBe("e2e-diagnostics.pdf");
    expect(res.body.isRemoved).toBe(false);
    expect(res.body.fileSize).toBeGreaterThan(0);

    attachmentId = res.body.id;
  });

  // -------------------------------------------------------------------------
  // Step 4: My Tickets List, Keyword Search & Filtering (API-03..05 / AC-04, AC-05)
  // -------------------------------------------------------------------------
  it("Step 4: queries My Tickets with search keyword and priority filter (API-03..05 / AC-04, AC-05)", async () => {
    // 4.1 Search by specific summary keyword
    const searchRes = await request(app)
      .get("/api/tickets?search=VPN+Gateway&status=NEW&priority=HIGH")
      .set(await requesterHeaders(jenniferId));

    expect(searchRes.status).toBe(200);
    expect(searchRes.body).toHaveProperty("data");
    expect(searchRes.body).toHaveProperty("pagination");

    const foundTicket = searchRes.body.data.find(
      (t: { id: number }) => t.id === createdTicketId
    );
    expect(foundTicket).toBeDefined();
    expect(foundTicket.ticketNumber).toBe(createdTicketNumber);
    expect(foundTicket.attachmentCount).toBe(1);

    // 4.2 Verify pagination envelope
    expect(searchRes.body.pagination).toHaveProperty("totalItems");
    expect(searchRes.body.pagination.totalItems).toBeGreaterThanOrEqual(1);
    expect(searchRes.body.pagination).toHaveProperty("page", 1);
  });

  // -------------------------------------------------------------------------
  // Step 5: Ticket Detail & Read-Only Inspection (API-06 / AC-04, AC-06)
  // -------------------------------------------------------------------------
  it("Step 5: inspects full ticket details and relational metadata (API-06 / AC-04)", async () => {
    const res = await request(app)
      .get(`/api/tickets/${createdTicketId}`)
      .set(await requesterHeaders(jenniferId));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdTicketId);
    expect(res.body.ticketNumber).toBe(createdTicketNumber);
    expect(res.body.summary).toBe(
      "E2E Flow Test - Critical VPN Gateway Failure"
    );
    expect(res.body.currentStatus).toBe("NEW");

    // Check relations
    expect(res.body).toHaveProperty("category");
    expect(res.body.category.id).toBe(softwareCategoryId);
    expect(res.body).toHaveProperty("relatedSystem");
    expect(res.body.relatedSystem.id).toBe(emailSystemId);
    expect(res.body).toHaveProperty("requester");
    expect(res.body.requester.id).toBe(jenniferId);

    // Check attachments
    expect(Array.isArray(res.body.attachments)).toBe(true);
    expect(res.body.attachments.length).toBe(1);
    expect(res.body.attachments[0].id).toBe(attachmentId);
    expect(res.body.attachments[0].fileName).toBe("e2e-diagnostics.pdf");
    expect(res.body.attachments[0].isRemoved).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Step 6: Attachment Download Streaming & Soft-Removal (API-11..13 / AC-08)
  // -------------------------------------------------------------------------
  it("Step 6a: streams binary download of active attachment with nosniff and RFC 6266 header (API-11 / AC-08)", async () => {
    const res = await request(app)
      .get(`/api/attachments/${attachmentId}/download`)
      .set(await requesterHeaders(jenniferId));

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/i);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-disposition"]).toMatch(/attachment/i);
    expect(res.headers["content-disposition"]).toMatch(/e2e-diagnostics\.pdf/i);

    const bodyContent = res.text || res.body.toString();
    expect(bodyContent).toContain("End-to-End Diagnostics Test Content");
  });

  it("Step 6b: soft-removes attachment with mandatory reason, preserving physical file (API-12 / AC-08)", async () => {
    const reasonText = "E2E verification completed; soft-removing diagnostics file";
    const res = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .set(await requesterHeaders(jenniferId))
      .send({ reason: reasonText });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(attachmentId);
    expect(res.body.isRemoved).toBe(true);
    expect(res.body.removedAt).not.toBeNull();
    expect(res.body.removalReason).toBe(reasonText);

    // Verify physical file retention in storage
    const inDb = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    expect(inDb).not.toBeNull();
    expect(inDb!.isRemoved).toBe(true);
    expect(fs.existsSync(inDb!.storedPath)).toBe(true);
  });

  it("Step 6c: rejects repeat delete with 409 Conflict to protect audit history (Audit Guard)", async () => {
    const res = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .set(await requesterHeaders(jenniferId))
      .send({ reason: "Attempting to overwrite previous audit record" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already been removed/i);
  });

  it("Step 6d: permanently blocks subsequent download of soft-removed attachment (API-13 / AC-08)", async () => {
    const res = await request(app)
      .get(`/api/attachments/${attachmentId}/download`)
      .set(await requesterHeaders(jenniferId));

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Attachment has been removed/i);
  });

  // -------------------------------------------------------------------------
  // Step 7: Cross-Requester Data Isolation Enforcement (API-07 / AC-06, FR-11)
  // -------------------------------------------------------------------------
  it("Step 7a: rejects cross-requester access when Requester B attempts to inspect ticket (API-07 / AC-06)", async () => {
    const res = await request(app)
      .get(`/api/tickets/${createdTicketId}`)
      .set(await requesterHeaders(michaelId));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("Step 7b: rejects cross-requester download when Requester B attempts to download attachment", async () => {
    const res = await request(app)
      .get(`/api/attachments/${attachmentId}/download`)
      .set(await requesterHeaders(michaelId));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("Step 7c: rejects cross-requester removal when Requester B attempts to delete attachment", async () => {
    const res = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .set(await requesterHeaders(michaelId))
      .send({ reason: "Malicious deletion attempt from another requester" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("Step 7d: ensures Requester B's My Tickets list excludes Requester A's tickets (Data Isolation)", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set(await requesterHeaders(michaelId));

    expect(res.status).toBe(200);
    const leakedTicket = res.body.data.find(
      (t: { id: number }) => t.id === createdTicketId
    );
    expect(leakedTicket).toBeUndefined();
  });
});
