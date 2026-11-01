import type { ActionRecord, ActionContext } from "../../src/actionWorkflow.js";

export const instant = new Date("2026-10-28T03:00:00.000Z");
export const context = (extra: Partial<ActionContext> = {}): ActionContext => ({
  actor: { id: 7, role: "IT_STAFF", isActive: true },
  parent: { id: 10, currentStatus: "IN_PROGRESS", workCycle: 2, workflowVersion: 3 },
  now: instant, ...extra,
});
export const action = (extra: Partial<ActionRecord> = {}): ActionRecord => ({
  ticketId: 10, cycle: 2, status: "PLANNED", description: "Work", result: null,
  assigneeId: 7, createdById: 8, performedById: null, followUpRequired: false,
  followUpNote: null, attachmentNotes: null, createdAt: new Date("2026-10-27T00:00:00.000Z"),
  updatedAt: new Date("2026-10-27T00:00:00.000Z"), completedAt: null, cancelledAt: null,
  cancellationReason: null, version: 4, ...extra,
});
