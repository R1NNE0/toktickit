import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import path from "path";
import fs from "fs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Lab 2 (Issue #4) - POST /api/tickets & Attachment Upload", () => {
  const prisma = getPrisma();
  let activeRequesterId: number;
  let otherRequesterId: number;
  let activeCategoryId: number;
  let activeRelatedSystemId: number;
  let tempFilePath: string;
  let oversizedFilePath: string;
  let invalidExtFilePath: string;

  beforeAll(async () => {
    // 1. Fetch active requesters
    const requesters = await prisma.requesterUser.findMany({
      where: { isActive: true },
    });
    expect(requesters.length).toBeGreaterThanOrEqual(2);
    activeRequesterId = requesters[0].id;
    otherRequesterId = requesters[1].id;

    // 2. Fetch active category & related system
    const category = await prisma.category.findFirst({
      where: { isActive: true },
    });
    expect(category).not.toBeNull();
    activeCategoryId = category!.id;

    const relatedSystem = await prisma.relatedSystem.findFirst({
      where: { isActive: true },
    });
    expect(relatedSystem).not.toBeNull();
    activeRelatedSystemId = relatedSystem!.id;

    // 3. Create temporary files for testing uploads
    const tempDir = path.resolve(process.cwd(), "tests/temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    tempFilePath = path.join(tempDir, "test_document.pdf");
    fs.writeFileSync(tempFilePath, "%PDF-1.4 Mock PDF Content");

    invalidExtFilePath = path.join(tempDir, "malicious.exe");
    fs.writeFileSync(invalidExtFilePath, "MOCK_EXE_BINARY_DATA");

    // 6 MB oversized file (> 5 MB limit)
    oversizedFilePath = path.join(tempDir, "oversized_file.png");
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 0);
    fs.writeFileSync(oversizedFilePath, largeBuffer);
  });

  afterAll(async () => {
    // Clean up temporary files
    try {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      if (fs.existsSync(invalidExtFilePath)) fs.unlinkSync(invalidExtFilePath);
      if (fs.existsSync(oversizedFilePath)) fs.unlinkSync(oversizedFilePath);
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  });

  describe("POST /api/tickets (Create Ticket)", () => {
    it("successfully creates a ticket with unique TKT-YYYY-XXXXXX number (API-01 / AC-01)", async () => {
      const payload = {
        summary: "Cannot access internal grading portal",
        description:
          "Encountered a 500 error when clicking the submit grade button.",
        categoryId: activeCategoryId,
        relatedSystemId: activeRelatedSystemId,
        requestedPriority: "HIGH",
      };

      const res = await request(app)
        .post("/api/tickets")
        .set("x-requester-id", activeRequesterId.toString())
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
      expect(res.body.summary).toBe(payload.summary);
      expect(res.body.description).toBe(payload.description);
      expect(res.body.requestedPriority).toBe("HIGH");
      expect(res.body.itPriority).toBe("MEDIUM");
      expect(res.body.currentStatus).toBe("NEW");
      expect(res.body.requesterId).toBe(activeRequesterId);
      expect(res.body.category.id).toBe(activeCategoryId);
      expect(res.body.relatedSystem.id).toBe(activeRelatedSystemId);
    });

    it("supports idempotency by returning existing ticket on identical key without duplicate creation", async () => {
      const idempotencyKey = `idemp-${Date.now()}-${Math.random()}`;
      const payload = {
        summary: "Idempotent Submission Test",
        description: "Testing duplicate prevention with idempotency key.",
        categoryId: activeCategoryId,
        relatedSystemId: activeRelatedSystemId,
        requestedPriority: "MEDIUM",
        idempotencyKey,
      };

      // First submit
      const res1 = await request(app)
        .post("/api/tickets")
        .set("x-requester-id", activeRequesterId.toString())
        .send(payload);

      expect(res1.status).toBe(201);
      const createdTicketId = res1.body.id;
      const createdTicketNumber = res1.body.ticketNumber;

      // Second submit with the same idempotency key
      const res2 = await request(app)
        .post("/api/tickets")
        .set("x-requester-id", activeRequesterId.toString())
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.id).toBe(createdTicketId);
      expect(res2.body.ticketNumber).toBe(createdTicketNumber);
    });

    it("rejects ticket submission when mandatory summary or description is missing or whitespace (API-02 / AC-02)", async () => {
      const res = await request(app)
        .post("/api/tickets")
        .set("x-requester-id", activeRequesterId.toString())
        .send({
          summary: "   ",
          description: "",
          categoryId: activeCategoryId,
          relatedSystemId: activeRelatedSystemId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
      expect(res.body.details).toBeInstanceOf(Array);
      const fields = res.body.details.map((d: any) => d.field);
      expect(fields).toContain("summary");
      expect(fields).toContain("description");
    });

    it("rejects ticket submission with invalid or inactive categoryId", async () => {
      const res = await request(app)
        .post("/api/tickets")
        .set("x-requester-id", activeRequesterId.toString())
        .send({
          summary: "Valid summary",
          description: "Valid description",
          categoryId: 999999,
          relatedSystemId: activeRelatedSystemId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Category does not exist/i);
    });

    it("rejects ticket submission without x-requester-id header", async () => {
      const res = await request(app).post("/api/tickets").send({
        summary: "Valid summary",
        description: "Valid description",
        categoryId: activeCategoryId,
        relatedSystemId: activeRelatedSystemId,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/x-requester-id/i);
    });
  });

  describe("POST /api/tickets/:id/attachments (Upload Attachment)", () => {
    let testTicketId: number;

    beforeAll(async () => {
      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-TEST-${Date.now()}`,
          summary: "Ticket for attachment tests",
          description: "Testing attachments upload endpoint.",
          requesterId: activeRequesterId,
          categoryId: activeCategoryId,
          relatedSystemId: activeRelatedSystemId,
        },
      });
      testTicketId = ticket.id;
    });

    it("successfully uploads a valid PDF attachment (API-08 / AC-07)", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicketId}/attachments`)
        .set("x-requester-id", activeRequesterId.toString())
        .attach("file", tempFilePath);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.ticketId).toBe(testTicketId);
      expect(res.body.fileName).toBe("test_document.pdf");
      expect(res.body.mimeType).toBe("application/pdf");
      expect(res.body.isRemoved).toBe(false);
    });

    it("rejects unsupported file MIME type like .exe (API-09 / BR-06)", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicketId}/attachments`)
        .set("x-requester-id", activeRequesterId.toString())
        .attach("file", invalidExtFilePath);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Unsupported file type/i);
    });

    it("rejects oversized file exceeding 5 MB limit (API-09 / BR-06)", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicketId}/attachments`)
        .set("x-requester-id", activeRequesterId.toString())
        .attach("file", oversizedFilePath);

      expect(res.status).toBe(413);
      expect(res.body.error).toMatch(/5 MB/i);
    });

    it("rejects attachment upload to another requester's ticket with 403 Forbidden (FR-11 / AC-06)", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicketId}/attachments`)
        .set("x-requester-id", otherRequesterId.toString())
        .attach("file", tempFilePath);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Forbidden/i);
    });

    it("rejects attachment upload when active attachment limit of 5 is exceeded (API-10 / BR-07)", async () => {
      // Seed up to 5 attachments on a new ticket
      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-LIMIT-${Date.now()}`,
          summary: "Ticket for limit tests",
          description: "Limit test ticket description",
          requesterId: activeRequesterId,
          categoryId: activeCategoryId,
          relatedSystemId: activeRelatedSystemId,
        },
      });

      // Insert 5 active attachments directly
      for (let i = 1; i <= 5; i++) {
        await prisma.attachment.create({
          data: {
            ticketId: ticket.id,
            fileName: `existing_${i}.pdf`,
            storedPath: `uploads/lab-02/mock_${i}.pdf`,
            fileSize: 1024,
            mimeType: "application/pdf",
            isRemoved: false,
          },
        });
      }

      // Attempt 6th upload
      const res = await request(app)
        .post(`/api/tickets/${ticket.id}/attachments`)
        .set("x-requester-id", activeRequesterId.toString())
        .attach("file", tempFilePath);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/maximum of 5 active attachments/i);
    });
  });
});
