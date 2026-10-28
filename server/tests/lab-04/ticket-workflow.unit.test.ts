import { describe, it, expect } from "vitest";
import { getTransitionRule, transitionOptions, transitionBlockers, VALID_STATUSES } from "../../src/workflow.js";

const ready = { eligibleOwner: true, completedActions: 1, incompleteActions: 0, outstandingFollowUps: 0 };
describe("L4-UNIT-03 Ticket workflow policy", () => {
  it("preserves exactly the 15 approved edges among all 64 status pairs", () => {
    const edges = ["NEW:OPEN", "NEW:CANCELLED", "OPEN:IN_PROGRESS", "OPEN:CANCELLED",
      "IN_PROGRESS:WAITING_FOR_REQUESTER", "IN_PROGRESS:RESOLVED", "IN_PROGRESS:CANCELLED",
      "WAITING_FOR_REQUESTER:IN_PROGRESS", "WAITING_FOR_REQUESTER:RESOLVED", "WAITING_FOR_REQUESTER:CANCELLED",
      "RESOLVED:CLOSED", "RESOLVED:REOPENED", "CLOSED:REOPENED", "REOPENED:OPEN", "REOPENED:CANCELLED"];
    for (const from of VALID_STATUSES) for (const to of VALID_STATUSES)
      expect(!!getTransitionRule(from, to)).toBe(edges.includes(from + ":" + to));
  });
  it.each([
    [{ ...ready, eligibleOwner: false }, ["OWNER_REQUIRED"]],
    [{ ...ready, completedActions: 0 }, ["COMPLETED_ACTION_REQUIRED"]],
    [{ ...ready, incompleteActions: 1 }, ["ACTIONS_INCOMPLETE"]],
    [{ ...ready, outstandingFollowUps: 1 }, ["FOLLOW_UP_REQUIRED"]],
    [ready, []],
  ])("reports each resolution predicate independently", (state, expected) => {
    expect(transitionBlockers(getTransitionRule("IN_PROGRESS", "RESOLVED")!, state)).toEqual(expected);
  });
  it("cancellation ignores follow-ups and completed count, but cannot abandon unfinished work", () => {
    const rule = getTransitionRule("NEW", "CANCELLED")!;
    expect(transitionBlockers(rule, { ...ready, eligibleOwner: false, completedActions: 0, outstandingFollowUps: 2 })).toEqual([]);
    expect(transitionBlockers(rule, { ...ready, incompleteActions: 2 })).toEqual(["ACTIONS_INCOMPLETE"]);
  });
  it("offers only source edges and never offers Requester/Admin formal status changes", () => {
    expect(transitionOptions("IN_PROGRESS", "IT_STAFF", ready).map(r => r.to)).toEqual(["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]);
    expect(transitionOptions("IN_PROGRESS", "REQUESTER", ready)).toEqual([]);
    expect(transitionOptions("IN_PROGRESS", "ADMINISTRATOR", ready)).toEqual([]);
    expect(transitionOptions("IN_PROGRESS", "IT_STAFF", { ...ready, completedActions: 0 })[1]).toMatchObject({ enabled: false, blockers: ["COMPLETED_ACTION_REQUIRED"] });
  });
});
