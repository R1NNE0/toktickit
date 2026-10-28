import { describe, expect, it } from "vitest";
import { creationFingerprint, parseCreateAction, parseEditAction } from "../../src/actionValidation.js";
import { planEditAction } from "../../src/actionWorkflow.js";
import { action, context } from "./domain-fixtures.js";

const body = { clientRequestId: "12345678-1234-4234-8234-123456789abc", expectedWorkflowVersion: 3, description: "Work" };
describe("L4-UNIT-05 fingerprint, no-op and version safety", () => {
  it("hashes normalized semantics independently of key, version, key order and defaults", () => {
    const a = parseCreateAction(body, 7);
    const b = parseCreateAction({ attachmentNotes: " ", result: null, assigneeId: 7, ...body,
      description: " Work ", expectedWorkflowVersion: 100, clientRequestId: "22345678-1234-4234-8234-123456789abc" }, 7);
    expect(creationFingerprint(10, a)).toMatch(/^[0-9a-f]{64}$/);
    expect(creationFingerprint(10, a)).toBe(creationFingerprint(10, b));
    expect(creationFingerprint(11, a)).not.toBe(creationFingerprint(10, a));
    for (const extra of [{ description: "Other" }, { assigneeId: 8 }, { result: "done" }, { followUpRequired: true, followUpNote: "check" }, { followUpNote: "note" }, { attachmentNotes: "file" }]) {
      expect(creationFingerprint(10, parseCreateAction({ ...body, ...extra }, 7))).not.toBe(creationFingerprint(10, a));
    }
  });
  it("does not mutate input or advance metadata for a normalized no-op", () => {
    const original = action();
    const result = planEditAction(original, parseEditAction({ expectedVersion: 4, expectedWorkflowVersion: 3, description: " Work ", changeReason: "not a change" }), context());
    expect(result).toMatchObject({ changed: false, operation: null, changeReason: null });
    expect(result.action).toEqual(original);
  });
  it("checks Ticket version before Action version and before no-op detection", () => {
    const parsed = parseEditAction({ expectedVersion: 1, expectedWorkflowVersion: 1, description: "Work" });
    expect(() => planEditAction(action(), parsed, context())).toThrowError(expect.objectContaining({ code: "TICKET_VERSION_CONFLICT" }));
    expect(() => planEditAction(action(), { ...parsed, expectedWorkflowVersion: 3 }, context())).toThrowError(expect.objectContaining({ code: "ACTION_VERSION_CONFLICT" }));
  });
  it("fails without wrapping counters", () => {
    const parsed = parseEditAction({ expectedVersion: 2147483647, expectedWorkflowVersion: 3, description: "changed" });
    expect(() => planEditAction(action({ version: 2147483647 }), parsed, context())).toThrow();
    expect(() => planEditAction(action(), { ...parsed, expectedVersion: 4, expectedWorkflowVersion: 2147483647 },
      context({ parent: { ...context().parent, workflowVersion: 2147483647 } }))).toThrow();
  });
});
