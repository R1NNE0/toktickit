import { describe, expect, it } from "vitest";
import { parseCreateAction, parseEditAction, parseTransitionAction } from "../../src/actionValidation.js";

const uuid = "12345678-1234-4234-8234-123456789abc";
const create = (extra: object = {}) => ({ clientRequestId: uuid, expectedWorkflowVersion: 1, description: " Work ", ...extra });
const versions = { expectedVersion: 1, expectedWorkflowVersion: 1 };

describe("L4-UNIT-01 Action input contract", () => {
  it("normalizes nullable text and defaults assignee independently of performer", () => {
    expect(parseCreateAction(create({ result: " \t", followUpNote: " note " }), 7)).toEqual({
      clientRequestId: uuid, expectedWorkflowVersion: 1, description: "Work", assigneeId: 7,
      result: null, followUpRequired: false, followUpNote: "note", attachmentNotes: null,
    });
  });
  it.each([undefined, null, "", " \n", 12, {}, "x".repeat(4001)])("rejects invalid description %j", description => {
    expect(() => parseCreateAction(create({ description }), 7)).toThrow();
  });
  it("counts Unicode code points rather than UTF-16 code units", () => {
    expect(parseCreateAction(create({ description: "😀".repeat(4000) }), 7).description).toHaveLength(8000);
    expect(() => parseCreateAction(create({ description: "😀".repeat(4001) }), 7)).toThrow();
  });
  it.each([null, "", " \t", undefined])("requires a nonblank follow-up note when true: %j", followUpNote => {
    expect(() => parseCreateAction(create({ followUpRequired: true, followUpNote }), 7)).toThrow();
  });
  it("accepts a retained note when follow-up is false and rejects oversized notes/results", () => {
    expect(parseCreateAction(create({ followUpRequired: false, followUpNote: " context " }), 7).followUpNote).toBe("context");
    for (const field of ["followUpNote", "attachmentNotes"]) {
      expect(() => parseCreateAction(create({ [field]: "😀".repeat(2001) }), 7)).toThrow();
    }
    expect(() => parseCreateAction(create({ result: "x".repeat(4001) }), 7)).toThrow();
  });
  it.each([0, -1, 1.5, "1", null, 2147483648])("rejects noncanonical body IDs/versions %j", value => {
    expect(() => parseCreateAction(create({ assigneeId: value }), 7)).toThrow();
    expect(() => parseCreateAction(create({ expectedWorkflowVersion: value }), 7)).toThrow();
  });
  it.each(["createdById", "performedById", "cycle", "status", "createdAt", "version", "createRequestHash", "unknown"])("rejects forged field %s", field => {
    expect(() => parseCreateAction(create({ [field]: 1 }), 7)).toThrow();
    expect(() => parseEditAction({ ...versions, description: "work", [field]: 1 })).toThrow();
  });
  it.each([[], null, true, "text"])("rejects non-object bodies %j", body => {
    expect(() => parseCreateAction(body, 7)).toThrow();
  });
  it("rejects malformed UUIDs and nonboolean flags", () => {
    expect(() => parseCreateAction(create({ clientRequestId: "not-uuid" }), 7)).toThrow();
    expect(() => parseCreateAction(create({ followUpRequired: "false" }), 7)).toThrow();
  });
  it("preserves omission versus explicit null in edits; rejects reason-only edits", () => {
    expect(parseEditAction({ ...versions, result: "  " })).toEqual({ ...versions, result: null });
    expect(() => parseEditAction({ ...versions, changeReason: "why" })).toThrow();
    expect(() => parseEditAction({ ...versions, description: "work", changeReason: " " })).toThrow();
  });
  it("requires completion result and an explicit boolean without prematurely validating preserved notes", () => {
    expect(parseTransitionAction({ ...versions, targetStatus: "COMPLETED", result: " Fixed ", followUpRequired: true }))
      .toEqual({ ...versions, targetStatus: "COMPLETED", result: "Fixed", followUpRequired: true });
    for (const result of [null, "", " ", "x".repeat(4001)]) {
      expect(() => parseTransitionAction({ ...versions, targetStatus: "COMPLETED", result, followUpRequired: false })).toThrow();
    }
    expect(() => parseTransitionAction({ ...versions, targetStatus: "COMPLETED", result: "Fixed" })).toThrow();
  });
  it("requires explicit cancellation confirmation/reason and rejects fields from other variants", () => {
    expect(parseTransitionAction({ ...versions, targetStatus: "CANCELLED", confirmed: true, reason: " Duplicate " }))
      .toEqual({ ...versions, targetStatus: "CANCELLED", confirmed: true, reason: "Duplicate" });
    for (const extra of [{ confirmed: false }, { reason: " " }, { reason: "x".repeat(4001) }, { performedById: 7 }]) {
      expect(() => parseTransitionAction({ ...versions, targetStatus: "CANCELLED", confirmed: true, reason: "why", ...extra })).toThrow();
    }
    expect(() => parseTransitionAction({ ...versions, targetStatus: "IN_PROGRESS", result: "extra" })).toThrow();
    expect(() => parseTransitionAction({ ...versions, targetStatus: "PLANNED" })).toThrow();
  });
});
