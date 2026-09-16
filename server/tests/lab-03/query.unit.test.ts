import { describe, expect, it } from "vitest";
import { requesterQuery, positiveId } from "../../src/middleware/requesterInput.js";

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
