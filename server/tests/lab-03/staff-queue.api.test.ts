import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import type { Ticket } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { requesterHeaders } from "./legacy-session.js";
import { hashPassword } from "../../src/auth/password.js";

describe("API-12/13 Staff Queue and API-05/07 role gate", () => {
  const db = getPrisma(), marker = "queue-" + randomUUID();
  const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
  const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
  let headers: Record<string, string>, staffId: number, adminId: number, requesterId: number, categoryId: number;
  let rows: Ticket[] = [];
  const get = (query = {}) => request(app).get("/api/staff/tickets").set(headers).query({ search: marker, ...query });
  beforeAll(async () => {
    staffId = (await db.user.findFirstOrThrow({ where: { role: "IT_STAFF", isActive: true } })).id;
    adminId = (await db.user.findFirstOrThrow({ where: { role: "ADMINISTRATOR", isActive: true } })).id;
    const requesters = await db.user.findMany({ where: { role: "REQUESTER", isActive: true }, take: 2 });
    requesterId = requesters[0].id;
    headers = await requesterHeaders(staffId);
    const categories = await db.category.findMany({ take: 2 }), system = await db.relatedSystem.findFirstOrThrow();
    categoryId = categories[0].id;
    for (let i = 0; i < 24; i++) rows.push(await db.ticket.create({ data: {
      ticketNumber: marker + "-" + String(i).padStart(2, "0"), summary: i === 0 ? "Summary Needle 100%_" : "Shared queue item",
      description: i === 1 ? "Description Needle" : "Details", requesterId: requesters[i % 2].id,
      categoryId: categories[i % 2].id, relatedSystemId: system.id, ownerId: [null, staffId, adminId][i % 3],
      requestedPriority: priorities[i % 4], itPriority: priorities[(i + 1) % 4], currentStatus: statuses[i % 8],
      createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-02-01"),
    } }));
    await db.attachment.createMany({ data: [false, true].map(isRemoved => ({ ticketId: rows[0].id, fileName: "queue.pdf",
      storedPath: "not-served", fileSize: 1, mimeType: "application/pdf", isRemoved })) });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => { await db.ticket.deleteMany({ where: { ticketNumber: { startsWith: marker } } }); });

  it("returns the shared queue across Requesters with exact safe references and active attachment counts", async () => {
    const response = await get({ pageSize: 50 }).expect(200), data = response.body.data;
    expect(new Set(data.map((row: Ticket) => row.requesterId)).size).toBe(2);
    expect(data.find((row: Ticket) => row.id === rows[0].id).attachmentCount).toBe(1);
    const adminOwned = data.find((row: Ticket) => row.ownerId === adminId);
    expect(Object.keys(adminOwned).sort()).toEqual(["id", "ticketNumber", "summary", "description", "requesterId", "categoryId",
      "relatedSystemId", "requestedPriority", "itPriority", "currentStatus", "ownerId", "owner", "category", "relatedSystem",
      "createdAt", "updatedAt", "resolutionSuggestedAt", "resolutionSuggestedById", "attachmentCount", "requester"].sort());
    expect(Object.keys(adminOwned.requester).sort()).toEqual(["email", "id", "name"]);
    expect(Object.keys(adminOwned.owner).sort()).toEqual(["id", "isActive", "name", "role"]);
    expect(adminOwned.owner.role).toBe("ADMINISTRATOR");
    expect(JSON.stringify(data)).not.toMatch(/password|tokenHash|csrfToken|storedPath|idempotencyKey|emailNormalized|internalNotes/i);
    expect(response.headers["cache-control"]).toBe("no-store");
  });
  it("searches all three fields, case-insensitively, treating percent/underscore as literal substrings", async () => {
    for (const search of [" summary needle ", "DESCRIPTION NEEDLE", marker + "-00", "100%_"]) {
      const response = await get({ search }).expect(200);
      expect(response.body.pagination.total).toBe(1);
    }
    const response = await get({ search: "' OR TRUE --" }).expect(200);
    expect(response.body.pagination.total).toBe(0);
  });
  it("applies every individual filter and combinations to both rows and total", async () => {
    const cases: [Record<string, unknown>, (row: Ticket) => boolean][] = [
      [{ categoryId }, row => row.categoryId === categoryId],
      ...statuses.map(status => [{ status }, (row: Ticket) => row.currentStatus === status] as [Record<string, unknown>, (row: Ticket) => boolean]),
      ...priorities.flatMap(priority => [
        [{ priority }, (row: Ticket) => row.requestedPriority === priority],
        [{ itPriority: priority }, (row: Ticket) => row.itPriority === priority],
      ] as [Record<string, unknown>, (row: Ticket) => boolean][]),
      [{ ownerId: staffId }, row => row.ownerId === staffId], [{ ownerId: adminId }, row => row.ownerId === adminId],
      [{ ownerId: "unassigned" }, row => row.ownerId === null],
      [{ categoryId, status: "NEW", requestedPriority: "LOW", itPriority: "MEDIUM", ownerId: "unassigned" },
        row => row.categoryId === categoryId && row.currentStatus === "NEW" && row.requestedPriority === "LOW" && row.itPriority === "MEDIUM" && row.ownerId === null],
    ];
    for (const [query, matches] of cases) {
      const expected = rows.filter(matches).map(row => row.id).sort((a, b) => b - a);
      const response = await get({ ...query, pageSize: 50 }).expect(200);
      expect(response.body.data.map((row: Ticket) => row.id)).toEqual(expected);
      expect(response.body.pagination.total).toBe(expected.length);
    }
    const alias = await get({ status: "NEW", currentStatus: "NEW", priority: "LOW", requestedPriority: "LOW", limit: 20 }).expect(200);
    expect(alias.body.pagination.pageSize).toBe(20);
  });
  it("uses explicit business ranks and deterministic ID ties for every supported sort and direction", async () => {
    for (const sortBy of ["createdAt", "updatedAt", "ticketNumber", "requestedPriority", "itPriority", "currentStatus"] as const) {
      const value = (row: Ticket): string | number => sortBy === "currentStatus" ? statuses.indexOf(row.currentStatus)
        : sortBy === "requestedPriority" || sortBy === "itPriority" ? priorities.indexOf(row[sortBy])
        : sortBy === "ticketNumber" ? row[sortBy] : row[sortBy].getTime();
      for (const sortOrder of ["asc", "desc"]) {
        const direction = sortOrder === "asc" ? 1 : -1;
        const expected = [...rows].sort((a, b) => ((value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : 0) || a.id - b.id) * direction);
        const response = await get({ sortBy, sortOrder, pageSize: 50 }).expect(200);
        expect(response.body.data.map((row: Ticket) => row.id)).toEqual(expected.map(row => row.id));
      }
    }
  });
  it("defaults to ten, preserves alias metadata, and pages without duplicates or missing rows", async () => {
    const seen: number[] = [];
    for (let page = 1; page <= 3; page++) {
      const response = await get({ page }).expect(200);
      expect(response.body.pagination).toEqual({ total: 24, totalItems: 24, page, currentPage: page, pageSize: 10, limit: 10, totalPages: 3 });
      expect(response.body.data).toHaveLength(page === 3 ? 4 : 10);
      seen.push(...response.body.data.map((row: Ticket) => row.id));
    }
    expect(seen).toEqual(rows.map(row => row.id).reverse());
    const outside = await get({ page: 4 }).expect(200);
    expect(outside.body.data).toEqual([]); expect(outside.body.pagination.page).toBe(4);
  });
  it("returns coherent empty/no-match metadata including nonexistent owner/category", async () => {
    for (const query of [{ search: randomUUID() }, { ownerId: 2147483647 }, { categoryId: 2147483647 }]) {
      const response = await get(query).expect(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination).toMatchObject({ total: 0, totalItems: 0, totalPages: 1, page: 1, pageSize: 10 });
    }
    // Empty whole queue without deleting unrelated regression fixtures.
    vi.spyOn(db, "$queryRaw").mockResolvedValueOnce([{ total: 0n }]).mockResolvedValueOnce([]);
    const empty = await request(app).get("/api/staff/tickets").set(headers).expect(200);
    expect(empty.body.data).toEqual([]); expect(empty.body.pagination.totalPages).toBe(1);
  });
  it.each(["status=ALL", "status=INVALID", "itPriority=high", "ownerId=0", "ownerId=1.2", "ownerId=2147483648",
    "ownerId=1&ownerId=2", "page=1&page=2", "page=-1", "page=2147483647", "pageSize=8", "limit=20&pageSize=10",
    "sortBy=owner", "sortOrder=up", "unknown=x", "requesterId=1", "priority=LOW&requestedPriority=HIGH", "categoryId=1x"])("rejects query %s", async query => {
    const response = await request(app).get("/api/staff/tickets?" + query).set(headers).expect(400);
    expect(response.body.code).toBe("INVALID_QUERY");
  });
  it("rejects anonymous/forged identities and Requester/Administrator roles before querying", async () => {
    await request(app).get("/api/staff/tickets").set("x-requester-id", String(staffId)).expect(401);
    for (const id of [requesterId, adminId]) {
      const response = await request(app).get("/api/staff/tickets?ownerId=bad").set(await requesterHeaders(id)).expect(403);
      expect(response.body.code).toBe("FORBIDDEN");
    }
    const spoofed = await get().set("x-requester-id", String(requesterId)).expect(200);
    expect(spoofed.body.pagination.total).toBe(24);
  });
  it.each(["restricted", "inactive", "expired", "revoked"])("rejects %s Staff sessions", async state => {
    const email = randomUUID() + "@example.com";
    const user = await db.user.create({ data: { name: "Queue gate", email, emailNormalized: email, role: "IT_STAFF",
      passwordHash: await hashPassword("Synthetic queue fixture only!"), mustChangePassword: state === "restricted" } });
    try {
      const session = await requesterHeaders(user.id);
      if (state === "inactive") await db.user.update({ where: { id: user.id }, data: { isActive: false } });
      if (state === "expired") await db.session.updateMany({ where: { userId: user.id }, data: { lastSeenAt: new Date(0) } });
      if (state === "revoked") await db.session.deleteMany({ where: { userId: user.id } });
      const response = await request(app).get("/api/staff/tickets").set(session).expect(state === "restricted" ? 403 : 401);
      expect(response.body.code).toBe(state === "restricted" ? "PASSWORD_CHANGE_REQUIRED" : "UNAUTHENTICATED");
    } finally { await db.user.delete({ where: { id: user.id } }); }
  });
  it("returns safe database errors", async () => {
    vi.spyOn(db, "$queryRaw").mockRejectedValueOnce(new Error("SQL password secret stack"));
    const response = await get().expect(500);
    expect(response.body).toEqual({ error: "Unable to complete the request.", code: "INTERNAL_ERROR" });
  });
});
