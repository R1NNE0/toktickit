import { expect, it } from "vitest";
import { staffQuery } from "../../src/staffQueue.js";
import { activeStatuses, outstandingPredicate } from "../../src/dashboardQueries.js";

it("normalizes offset ranges and resolves me using the authenticated identity", () => {
  const q = staffQuery({ ownerId: "me", statusGroup: "active", updatedFrom: "2026-10-01T07:00:00+07:00", updatedTo: "2026-10-02T00:00:00Z" }, 42);
  expect(q.ownerId).toBe(42); expect(q.updated?.from.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  expect(q.page).toBe(1); expect(q.pageSize).toBe(10);
  expect(activeStatuses).toContain("REOPENED"); expect(activeStatuses).not.toContain("RESOLVED");
});
it.each([
  { statusGroup: "active", status: "NEW" }, { statusGroup: "active", currentStatus: "NEW" },
  { statusGroup: "unknown" }, { updatedFrom: "2026-01-01T00:00:00Z" },
  { updatedFrom: "2026-01-01", updatedTo: "2026-01-02" },
  { updatedFrom: "2026-02-30T00:00:00Z", updatedTo: "2026-03-04T00:00:00Z" },
  { updatedFrom: "2026-01-02T00:00:00Z", updatedTo: "2026-01-02T00:00:00Z" },
  { resolvedFrom: "2026-01-01T00:00:00Z", resolvedTo: "2026-01-02T00:00:00Z" },
  { status: "CLOSED", currentStatus: "RESOLVED" }, { ownerId: "me" },
])("rejects invalid or contradictory filters %j", query => expect(() => staffQuery(query)).toThrow());
it("preserves aliases and applies both ranges with a resolved classification", () => {
  const q = staffQuery({ currentStatus: "CLOSED", limit: "20", requestedPriority: "HIGH", resolvedFrom: "2026-01-01T00:00:00Z", resolvedTo: "2026-01-02T00:00:00Z", updatedFrom: "2026-01-01T00:00:00Z", updatedTo: "2026-01-03T00:00:00Z" });
  expect(q).toMatchObject({ status: "CLOSED", pageSize: 20, priority: "HIGH" }); expect(q.resolved).toBeDefined(); expect(q.updated).toBeDefined();
});
it("shares assigned/current-cycle/active predicates without performer attribution", () => {
  const p = outstandingPredicate(42); expect(p.values).toContain(42);
  expect(p.sql).toContain('a."assigneeId"'); expect(p.sql).toContain('a.cycle=t."workCycle"'); expect(p.sql).not.toContain("performedById");
});
