import { requesterHeaders } from "../lab-03/legacy-session.js";
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import path from "path";
import fs from "fs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Lab 2 (Issue #6) - Ticket Detail, Attachment Download & Soft Removal", () => {
  const prisma = getPrisma();
  let jenniferId: number;
  let michaelId: number;
  let jenniferTicketId: number;
  let activeAttachmentId: number;
  let dummyFilePath: string;

  beforeAll(async () => {
    // 1. Get seeded requesters
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

    // 2. Get Jennifer's seeded ticket TKT-2026-000101
    const ticket101 = await prisma.ticket.findUnique({
      where: { ticketNumber: "TKT-2026-000101" },
    });
    expect(ticket101).not.toBeNull();
    jenniferTicketId = ticket101!.id;

    // 3. Ensure a physical file exists for attachment download test
    const uploadDir = path.resolve(process.cwd(), process.env.TEST_UPLOAD_ROOT!);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    dummyFilePath = path.join(uploadDir, `test-attachment-${Date.now()}.pdf`);
    fs.writeFileSync(dummyFilePath, "Sample PDF binary content for testing download");

    // 4. Create an active attachment in database pointing to this physical file
    const attachment = await prisma.attachment.create({
      data: {
        ticketId: jenniferTicketId,
        fileName: "diagnostics-log.pdf",
        storedPath: dummyFilePath,
        fileSize: 45,
        mimeType: "application/pdf",
        isRemoved: false,
      },
    });
    activeAttachmentId = attachment.id;
  });

  describe("GET /api/tickets/:id (API-06 / API-07)", () => {
    it("returns 200 OK with full details and attachments for owned ticket (API-06 / FR-07 / AC-04)", async () => {
      const res = await request(app)
        .get(`/api/tickets/${jenniferTicketId}`)
        .set(await requesterHeaders(jenniferId));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id", jenniferTicketId);
      expect(res.body).toHaveProperty("ticketNumber", "TKT-2026-000101");
      expect(res.body).toHaveProperty("summary");
      expect(res.body).toHaveProperty("description");
      expect(res.body).toHaveProperty("category");
      expect(res.body.category).toHaveProperty("name");
      expect(res.body).toHaveProperty("relatedSystem");
      expect(res.body.relatedSystem).toHaveProperty("name");
      expect(res.body).toHaveProperty("requester");
      expect(res.body.requester).toHaveProperty("name", "Jennifer Anderson");

      // Verify attachments array contains both active and removed attachments
      expect(res.body).toHaveProperty("attachments");
      expect(Array.isArray(res.body.attachments)).toBe(true);
      expect(res.body.attachments.length).toBeGreaterThanOrEqual(1);

      const found = res.body.attachments.find(
        (a: any) => a.id === activeAttachmentId
      );
      expect(found).toBeDefined();
      expect(found.fileName).toBe("diagnostics-log.pdf");
      expect(found.isRemoved).toBe(false);
    });

    it("rejects cross-requester access with 403 Forbidden when Requester B attempts to view Requester A's ticket (API-07 / FR-11 / AC-06)", async () => {
      // Michael attempts to fetch Jennifer's ticket
      const res = await request(app)
        .get(`/api/tickets/${jenniferTicketId}`)
        .set(await requesterHeaders(michaelId));

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/Forbidden|permission/i);
    });

    it("returns 404 Not Found for non-existent ticket ID", async () => {
      const res = await request(app)
        .get("/api/tickets/99999999")
        .set(await requesterHeaders(jenniferId));

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error", "Ticket not found");
    });

    it("returns 400 Bad Request for non-numeric ticket ID", async () => {
      const res = await request(app)
        .get("/api/tickets/invalid-id")
        .set(await requesterHeaders(jenniferId));

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Invalid ticket ID");
    });
  });

  describe("GET /api/attachments/:id/download (API-11 / API-13)", () => {
    it("streams binary download for active attachment on owned ticket (API-11 / FR-09 / AC-08)", async () => {
      const res = await request(app)
        .get(`/api/attachments/${activeAttachmentId}/download`)
        .set(await requesterHeaders(jenniferId));

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/pdf/i);
      expect(res.headers["content-disposition"]).toMatch(/attachment/i);
      expect(res.headers["content-disposition"]).toMatch(/diagnostics-log\.pdf/i);
      const content = res.text || res.body.toString();
      expect(content).toBe("Sample PDF binary content for testing download");
    });

    it("blocks download with 403 Forbidden when Requester B attempts to download Requester A's file", async () => {
      const res = await request(app)
        .get(`/api/attachments/${activeAttachmentId}/download`)
        .set(await requesterHeaders(michaelId));

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/permission|Forbidden/i);
    });
  });

  describe("DELETE /api/attachments/:id (API-12 / API-13 / Soft Removal)", () => {
    it("validates that removal reason is required and non-empty", async () => {
      const res = await request(app)
        .delete(`/api/attachments/${activeAttachmentId}`)
        .set(await requesterHeaders(jenniferId))
        .send({ reason: "   " });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/reason is required/i);
    });

    it("blocks removal with 403 Forbidden when another requester attempts to delete", async () => {
      const res = await request(app)
        .delete(`/api/attachments/${activeAttachmentId}`)
        .set(await requesterHeaders(michaelId))
        .send({ reason: "Unauthorized attempt" });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/permission|Forbidden/i);
    });

    it("soft-removes attachment with reason, updates DB, and keeps physical file on disk (API-12 / FR-10 / AC-08)", async () => {
      const removalReason = "Attached outdated diagnostics report by mistake";
      const res = await request(app)
        .delete(`/api/attachments/${activeAttachmentId}`)
        .set(await requesterHeaders(jenniferId))
        .send({ reason: removalReason });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id", activeAttachmentId);
      expect(res.body).toHaveProperty("isRemoved", true);
      expect(res.body).toHaveProperty("removedAt");
      expect(res.body).toHaveProperty("removalReason", removalReason);

      // Verify in database
      const inDb = await prisma.attachment.findUnique({
        where: { id: activeAttachmentId },
      });
      expect(inDb).not.toBeNull();
      expect(inDb!.isRemoved).toBe(true);
      expect(inDb!.removedAt).not.toBeNull();
      expect(inDb!.removalReason).toBe(removalReason);

      // Verify physical file was NOT deleted from filesystem (Soft removal)
      expect(fs.existsSync(dummyFilePath)).toBe(true);
    });

    it("permanently blocks subsequent download of soft-removed attachment with 403 Forbidden (API-13 / BR-08 / AC-08)", async () => {
      const res = await request(app)
        .get(`/api/attachments/${activeAttachmentId}/download`)
        .set(await requesterHeaders(jenniferId));

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/Attachment has been removed/i);
    });
  });
});
