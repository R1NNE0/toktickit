import request from "supertest";
import { expect, it } from "vitest";
import { app } from "../../src/app.js";
import { fixture } from "./api-fixtures.js";

it("rejects contradictory groups, unpaired ranges, and invalid calendar dates while preserving aliases", async () => {
  const f = await fixture();
  for (const query of [
    { statusGroup: "active", currentStatus: "OPEN" }, { statusGroup: "active", status: "NEW" },
    { updatedFrom: "2026-10-01T00:00:00Z" }, { updatedFrom: "2026-02-30T00:00:00Z", updatedTo: "2026-03-03T00:00:00Z" },
    { resolvedFrom: "2026-10-01T00:00:00Z", resolvedTo: "2026-10-08T00:00:00Z" },
    { currentStatus: "OPEN", status: "CLOSED" }, { ownerId: "0" }, { pageSize: "8" },
  ]) await request(app).get("/api/staff/tickets").query(query).set(f.staffHeaders).expect(400);
  const r = await request(app).get("/api/staff/tickets").query({ currentStatus: "NEW", requestedPriority: "MEDIUM", limit: "20" }).set(f.staffHeaders).expect(200);
  expect(r.body.pagination).toMatchObject({ page: 1, currentPage: 1, pageSize: 20, limit: 20 });
  await request(app).get("/api/staff/tickets?ownerId=me").set(f.requesterHeaders).expect(403);
});
