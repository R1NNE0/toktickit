import { describe, expect, it } from "vitest";
import { requesterQuery, positiveId } from "../../src/middleware/requesterInput.js";
import { staffQuery, priorityOrder, statusOrder } from "../../src/staffQueue.js";

describe("UNIT-05 Staff query contract", () => {
  it("uses the approved ranks, defaults, aliases and bounded sizes", () => {
    expect(priorityOrder).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
    expect(statusOrder).toEqual(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"]);
    expect(staffQuery({})).toMatchObject({ page: 1, pageSize: 10, sortBy: "createdAt", sortOrder: "desc" });
    for (const size of ["10", "20", "50"]) expect(staffQuery({ pageSize: size, limit: size }).pageSize).toBe(Number(size));
    expect(staffQuery({ ownerId: "unassigned", itPriority: "CRITICAL", sortBy: "itPriority" })).toMatchObject({ ownerId: null, itPriority: "CRITICAL", sortBy: "itPriority" });
    expect(staffQuery({ ownerId: "2147483647", status: "WAITING_FOR_REQUESTER", currentStatus: "WAITING_FOR_REQUESTER" }).ownerId).toBe(2147483647);
  });
  it.each([{ pageSize: "8" }, { pageSize: "5" }, { ownerId: "0" }, { ownerId: "1x" }, { ownerId: "1.2" },
    { ownerId: "2147483648" }, { ownerId: ["1", "2"] }, { itPriority: "ALL" }, { itPriority: ["LOW"] },
    { status: "ALL" }, { page: "2147483647" }, { requesterId: "1" }])("rejects Staff-specific invalid values %#", query => {
    expect(() => staffQuery(query)).toThrow();
  });
});

describe("UNIT-05 Requester query contract", () => {
  it("defaults to ten and preserves explicit eight and agreeing aliases", () => {
    expect(requesterQuery({})).toMatchObject({ page: 1, pageSize: 10, sortBy: "createdAt", sortOrder: "desc" });
    expect(requesterQuery({ pageSize: "8", limit: "8", status: "NEW", currentStatus: "NEW" }).pageSize).toBe(8);
  });
  it.each([{ page: "1x" }, { page: "1.5" }, { page: "2147483648" }, { page: ["1", "2"] },
    { pageSize: "2" }, { pageSize: "5", limit: "8" }, { sortBy: "unknown" }, { sortOrder: "up" },
    { requesterId: "2" }, { unknown: "x" }, { status: "NEW", currentStatus: "CLOSED" },
    { priority: "LOW", requestedPriority: "HIGH" }, { categoryId: "1.2" }, { search: "x".repeat(201) }])("rejects invalid query %#", query => {
    expect(() => requesterQuery(query)).toThrow();
  });
  it.each(["1x", "1.5", "0", "-1", "2147483648", [], {}])("rejects malformed resource ID %#", value => {
    expect(() => positiveId(value, "ticket")).toThrow();
  });
});
