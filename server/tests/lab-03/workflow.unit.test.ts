import { describe, it, expect } from "vitest";
import {
  VALID_STATUSES,
  TRANSITION_MATRIX,
  getTransitionRule,
  ACTIVE_RESOLUTION_STATUSES,
  TERMINAL_RESOLUTION_STATUSES,
  validateTextBody,
} from "../../src/workflow.js";

describe("UNIT-04: Workflow state machine and transition rules", () => {
  it("defines exactly the 15 approved transitions across all 8x8 status pairs", () => {
    let validCount = 0;
    for (const from of VALID_STATUSES) {
      for (const to of VALID_STATUSES) {
        const rule = getTransitionRule(from, to);
        if (rule) {
          validCount++;
          expect(rule.from).toBe(from);
          expect(rule.to).toBe(to);
        }
      }
    }
    expect(validCount).toBe(15);
    expect(Object.keys(TRANSITION_MATRIX)).toHaveLength(15);
  });

  it("prohibits all self-transitions with 0 valid rules", () => {
    for (const st of VALID_STATUSES) {
      expect(getTransitionRule(st, st)).toBeNull();
    }
  });

  it("marks CANCELLED as strictly terminal with no outgoing edges", () => {
    for (const to of VALID_STATUSES) {
      expect(getTransitionRule("CANCELLED", to)).toBeNull();
    }
  });

  it("identifies all transitions requiring an active eligible owner", () => {
    const ownerEdges = Object.entries(TRANSITION_MATRIX)
      .filter(([, r]) => r.requiresOwner)
      .map(([k]) => k)
      .sort();

    expect(ownerEdges).toEqual([
      "IN_PROGRESS->RESOLVED",
      "OPEN->IN_PROGRESS",
      "WAITING_FOR_REQUESTER->IN_PROGRESS",
      "WAITING_FOR_REQUESTER->RESOLVED",
    ]);
  });

  it("identifies all transitions requiring confirmation", () => {
    const confirmEdges = Object.entries(TRANSITION_MATRIX)
      .filter(([, r]) => r.requiresConfirmation)
      .map(([k]) => k)
      .sort();

    expect(confirmEdges).toEqual([
      "CLOSED->REOPENED",
      "IN_PROGRESS->CANCELLED",
      "IN_PROGRESS->RESOLVED",
      "NEW->CANCELLED",
      "OPEN->CANCELLED",
      "REOPENED->CANCELLED",
      "RESOLVED->CLOSED",
      "RESOLVED->REOPENED",
      "WAITING_FOR_REQUESTER->CANCELLED",
      "WAITING_FOR_REQUESTER->RESOLVED",
    ]);
  });

  it("identifies all transitions requiring a public reason", () => {
    const reasonEdges = Object.entries(TRANSITION_MATRIX)
      .filter(([, r]) => r.requiresReason)
      .map(([k]) => k)
      .sort();

    expect(reasonEdges).toEqual([
      "CLOSED->REOPENED",
      "IN_PROGRESS->CANCELLED",
      "NEW->CANCELLED",
      "OPEN->CANCELLED",
      "REOPENED->CANCELLED",
      "RESOLVED->REOPENED",
      "WAITING_FOR_REQUESTER->CANCELLED",
    ]);
  });

  it("identifies reopening transitions as the only ones that clear resolution indication", () => {
    const clearingEdges = Object.entries(TRANSITION_MATRIX)
      .filter(([, r]) => r.clearsResolution)
      .map(([k]) => k)
      .sort();

    expect(clearingEdges).toEqual([
      "CLOSED->REOPENED",
      "RESOLVED->REOPENED",
    ]);
  });

  it("correctly partitions active vs terminal resolution indication statuses", () => {
    expect(ACTIVE_RESOLUTION_STATUSES).toEqual([
      "NEW",
      "OPEN",
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "REOPENED",
    ]);
    expect(TERMINAL_RESOLUTION_STATUSES).toEqual([
      "RESOLVED",
      "CLOSED",
      "CANCELLED",
    ]);
    expect([...ACTIVE_RESOLUTION_STATUSES, ...TERMINAL_RESOLUTION_STATUSES].sort()).toEqual(
      [...VALID_STATUSES].sort()
    );
  });

  it("validates comment and note bodies within 1-4000 characters and rejects empty/whitespace", () => {
    expect(validateTextBody("  hello world  ")).toBe("hello world");
    expect(() => validateTextBody("")).toThrow();
    expect(() => validateTextBody("    ")).toThrow();
    expect(() => validateTextBody("a".repeat(4001))).toThrow();
    expect(validateTextBody("a".repeat(4000))).toBe("a".repeat(4000));
  });
});
