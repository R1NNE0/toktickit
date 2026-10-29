import { describe, expect, it } from "vitest";
import { planCreateAction, planEditAction, planActionTransition, canTransitionAction } from "../../src/actionWorkflow.js";
import { parseCreateAction, parseEditAction, parseTransitionAction } from "../../src/actionValidation.js";
import { action, context, instant } from "./domain-fixtures.js";

const versions = { expectedVersion: 4, expectedWorkflowVersion: 3 };
const edit = (data: object) => parseEditAction({ ...versions, ...data });
const transition = (targetStatus: string) => parseTransitionAction({ ...versions, targetStatus,
  ...(targetStatus === "COMPLETED" ? { result: "Fixed", followUpRequired: false } : {}),
  ...(targetStatus === "CANCELLED" ? { confirmed: true, reason: "Duplicate" } : {}),
});
const states = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

describe("L4-UNIT-02 Action lifecycle and attribution", () => {
  it.each(states.flatMap(from => states.map(to => [from, to] as const)))("edge %s -> %s", (from, to) => {
    const allowed = ["PLANNED:IN_PROGRESS", "PLANNED:CANCELLED", "IN_PROGRESS:COMPLETED", "IN_PROGRESS:CANCELLED"];
    expect(canTransitionAction(from, to)).toBe(allowed.includes(from + ":" + to));
  });
  it("creates planned work with separate creator/assignee and no fabricated performer", () => {
    const body = parseCreateAction({ clientRequestId: "12345678-1234-4234-8234-123456789abc", expectedWorkflowVersion: 3, description: "work", assigneeId: 9 }, 7);
    const result = planCreateAction(body, context({ assignee: { id: 9, role: "ADMINISTRATOR", isActive: true } }));
    expect(result.action).toMatchObject({ ticketId: 10, cycle: 2, status: "PLANNED", version: 1,
      createdById: 7, assigneeId: 9, performedById: null, completedAt: null, createdAt: instant });
    expect(result.operation).toBe("CREATE");
  });
  it("captures the authenticated completing assignee, preserving creator and creation time", () => {
    const original = action({ status: "IN_PROGRESS" });
    const result = planActionTransition(original, transition("COMPLETED"), context());
    expect(result.action).toMatchObject({ status: "COMPLETED", createdById: 8, assigneeId: 7,
      performedById: 7, completedAt: instant, result: "Fixed", version: 5, createdAt: original.createdAt });
    expect(original.status).toBe("IN_PROGRESS");
  });
  it("permits eligible Admin completion but refuses implicit reassignment", () => {
    expect(planActionTransition(action({ status: "IN_PROGRESS" }), transition("COMPLETED"),
      context({ actor: { id: 7, role: "ADMINISTRATOR", isActive: true } })).action.performedById).toBe(7);
    expect(() => planActionTransition(action({ assigneeId: 9 }), transition("IN_PROGRESS"),
      context({ assignee: { id: 9, role: "IT_STAFF", isActive: true } }))).toThrowError(expect.objectContaining({ code: "ACTION_ASSIGNEE_REQUIRED" }));
  });
  it("blocks unavailable assignees from starting but permits recovery edits and cancellation", () => {
    const ctx = context({ assignee: { id: 9, role: "IT_STAFF", isActive: false } });
    const original = action({ assigneeId: 9 });
    expect(() => planActionTransition(original, transition("IN_PROGRESS"), ctx)).toThrowError(expect.objectContaining({ code: "ACTION_ASSIGNEE_UNAVAILABLE" }));
    expect(planEditAction(original, edit({ description: "updated" }), ctx).changed).toBe(true);
    expect(planActionTransition(original, transition("CANCELLED"), ctx).action).toMatchObject({ performedById: null, cancelledAt: instant, cancellationReason: "Duplicate" });
    expect(() => planEditAction(action(), edit({ assigneeId: 9 }), ctx)).toThrowError(expect.objectContaining({ code: "INELIGIBLE_ASSIGNEE" }));
  });
  it("records multi-field reassignment once without resetting in-progress work", () => {
    const result = planEditAction(action({ status: "IN_PROGRESS" }), edit({ assigneeId: 9, description: "new" }),
      context({ assignee: { id: 9, role: "IT_STAFF", isActive: true } }));
    expect(result).toMatchObject({ operation: "REASSIGN", changed: true, action: { status: "IN_PROGRESS", version: 5, createdById: 8 } });
  });
  it("validates the resulting follow-up state and preserves omitted notes on completion", () => {
    expect(() => planEditAction(action(), edit({ followUpRequired: true }), context())).toThrow();
    const original = action({ status: "IN_PROGRESS", followUpRequired: true, followUpNote: "Monitor" });
    const body = parseTransitionAction({ ...versions, targetStatus: "COMPLETED", result: "fixed", followUpRequired: true });
    expect(planActionTransition(original, body, context()).action.followUpNote).toBe("Monitor");
  });
  it("allows explained completed corrections without changing completion identities/times", () => {
    const original = action({ status: "COMPLETED", result: "fixed", performedById: 7, completedAt: instant, followUpRequired: true, followUpNote: "check" });
    expect(() => planEditAction(original, edit({ followUpRequired: false }), context())).toThrow();
    const result = planEditAction(original, edit({ followUpRequired: false, changeReason: "Checked" }), context());
    expect(result.action).toMatchObject({ createdById: 8, performedById: 7, completedAt: instant, followUpNote: "check", followUpRequired: false });
    expect(result.changeReason).toBe("Checked");
    expect(() => planEditAction(original, edit({ assigneeId: 7, changeReason: "why" }), context())).toThrow();
    expect(() => planEditAction(original, edit({ result: null, changeReason: "why" }), context())).toThrow();
  });
  it("blocks terminal/old-cycle edits and Requester writes even for no-ops", () => {
    expect(() => planEditAction(action({ status: "CANCELLED" }), edit({ description: "Work" }), context())).toThrow();
    expect(() => planEditAction(action({ cycle: 1 }), edit({ description: "Work" }), context())).toThrowError(expect.objectContaining({ code: "TICKET_CYCLE_CONFLICT" }));
    for (const currentStatus of ["RESOLVED", "CLOSED", "CANCELLED"] as const) {
      expect(() => planEditAction(action(), edit({ description: "Work" }), context({ parent: { ...context().parent, currentStatus } }))).toThrow();
    }
    expect(() => planEditAction(action(), edit({ description: "new" }), context({ actor: { id: 7, role: "REQUESTER", isActive: true } }))).toThrow();
  });
  it("rejects forbidden transitions at the mutation boundary", () => {
    expect(() => planActionTransition(action(), transition("COMPLETED"), context())).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
    expect(() => planActionTransition(action({ status: "COMPLETED" }), transition("CANCELLED"), context())).toThrow();
  });
});
