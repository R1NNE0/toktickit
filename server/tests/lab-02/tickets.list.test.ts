import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Lab 2 (Issue #5) - GET /api/tickets (My Tickets List, Search, Filter, Pagination)", () => {
  const prisma = getPrisma();
  let jenniferId: number;
  let michaelId: number;
  let hardwareCategoryId: number;
  let networkCategoryId: number;

  beforeAll(async () => {
    // 1. Get seeded requesters
    const jennifer = await prisma.requesterUser.findUnique({
      where: { email: "jennifer.anderson@example.com" },
    });
    const michael = await prisma.requesterUser.findUnique({
      where: { email: "michael.brown@example.com" },
    });

    expect(jennifer).not.toBeNull();
    expect(michael).not.toBeNull();
    jenniferId = jennifer!.id;
    michaelId = michael!.id;

    // 2. Get seeded categories
    const hardware = await prisma.category.findUnique({
      where: { name: "Hardware" },
    });
    const network = await prisma.category.findUnique({
      where: { name: "Network" },
    });

    expect(hardware).not.toBeNull();
    expect(network).not.toBeNull();
    hardwareCategoryId = hardware!.id;
    networkCategoryId = network!.id;
  });

  it("strictly isolates tickets: Requester A sees only their tickets and never Requester B's tickets (API-03 / AC-04)", async () => {
    // Jennifer requests her tickets
    const resJennifer = await request(app)
      .get("/api/tickets")
      .set("x-requester-id", jenniferId.toString());

    expect(resJennifer.status).toBe(200);
    expect(resJennifer.body).toHaveProperty("data");
    expect(resJennifer.body.data.length).toBeGreaterThanOrEqual(3);

    // All tickets returned must belong to Jennifer
    for (const ticket of resJennifer.body.data) {
      expect(ticket.requesterId).toBe(jenniferId);
      expect(ticket.ticketNumber).not.toBe("TKT-2026-000104"); // Michael's ticket
      expect(ticket.ticketNumber).not.toBe("TKT-2026-000105"); // Michael's ticket
    }

    // Michael requests his tickets
    const resMichael = await request(app)
      .get("/api/tickets")
      .set("x-requester-id", michaelId.toString());

    expect(resMichael.status).toBe(200);
    expect(resMichael.body.data.length).toBeGreaterThanOrEqual(2);

    for (const ticket of resMichael.body.data) {
      expect(ticket.requesterId).toBe(michaelId);
      expect(ticket.ticketNumber).not.toBe("TKT-2026-000101"); // Jennifer's ticket
    }
  });

  it("searches tickets case-insensitively by summary, description, and ticketNumber (API-04 / AC-05)", async () => {
    // Search Jennifer's tickets for "battery"
    const resSearch = await request(app)
      .get("/api/tickets?search=battery")
      .set("x-requester-id", jenniferId.toString());

    expect(resSearch.status).toBe(200);
    expect(resSearch.body.data.length).toBeGreaterThanOrEqual(1);
    expect(resSearch.body.data[0].summary).toMatch(/battery/i);

    // Search by exact ticket number
    const resNumber = await request(app)
      .get("/api/tickets?search=TKT-2026-000102")
      .set("x-requester-id", jenniferId.toString());

    expect(resNumber.status).toBe(200);
    expect(resNumber.body.data.length).toBe(1);
    expect(resNumber.body.data[0].ticketNumber).toBe("TKT-2026-000102");
  });

  it("filters tickets by status and category (API-04 / AC-05)", async () => {
    // Filter Jennifer's tickets by status = RESOLVED
    const resStatus = await request(app)
      .get("/api/tickets?currentStatus=RESOLVED")
      .set("x-requester-id", jenniferId.toString());

    expect(resStatus.status).toBe(200);
    expect(resStatus.body.data.length).toBeGreaterThanOrEqual(1);
    for (const ticket of resStatus.body.data) {
      expect(ticket.currentStatus).toBe("RESOLVED");
    }

    // Filter Jennifer's tickets by category = Network
    const resCategory = await request(app)
      .get(`/api/tickets?categoryId=${networkCategoryId}`)
      .set("x-requester-id", jenniferId.toString());

    expect(resCategory.status).toBe(200);
    expect(resCategory.body.data.length).toBeGreaterThanOrEqual(1);
    for (const ticket of resCategory.body.data) {
      expect(ticket.categoryId).toBe(networkCategoryId);
    }
  });

  it("supports pagination with total, totalPages, page, and pageSize metadata (API-05 / AC-05)", async () => {
    const pageSize = 2;
    // Page 1
    const resPage1 = await request(app)
      .get(`/api/tickets?page=1&pageSize=${pageSize}`)
      .set("x-requester-id", jenniferId.toString());

    expect(resPage1.status).toBe(200);
    expect(resPage1.body.data.length).toBe(pageSize);
    expect(resPage1.body.pagination).toMatchObject({
      page: 1,
      pageSize,
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
    expect(resPage1.body.pagination.total).toBeGreaterThanOrEqual(3);

    // Page 2
    const resPage2 = await request(app)
      .get(`/api/tickets?page=2&pageSize=${pageSize}`)
      .set("x-requester-id", jenniferId.toString());

    expect(resPage2.status).toBe(200);
    expect(resPage2.body.data.length).toBeGreaterThanOrEqual(1);
    expect(resPage2.body.pagination.page).toBe(2);

    // Items on Page 1 and Page 2 should not overlap
    const idSet1 = new Set(resPage1.body.data.map((t: any) => t.id));
    for (const t of resPage2.body.data) {
      expect(idSet1.has(t.id)).toBe(false);
    }
  });

  it("defaults sorting to createdAt DESC (BR-13)", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("x-requester-id", jenniferId.toString());

    expect(res.status).toBe(200);
    const tickets = res.body.data;
    expect(tickets.length).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < tickets.length - 1; i++) {
      const current = new Date(tickets[i].createdAt).getTime();
      const next = new Date(tickets[i + 1].createdAt).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });

  it("rejects invalid query parameters and missing requester header with 400", async () => {
    // Missing header
    const resNoHeader = await request(app).get("/api/tickets");
    expect(resNoHeader.status).toBe(400);

    // Negative page
    const resNegPage = await request(app)
      .get("/api/tickets?page=-1")
      .set("x-requester-id", jenniferId.toString());
    expect(resNegPage.status).toBe(400);

    // Invalid status enum
    const resBadStatus = await request(app)
      .get("/api/tickets?status=INVALID_STATUS")
      .set("x-requester-id", jenniferId.toString());
    expect(resBadStatus.status).toBe(400);
  });
});
