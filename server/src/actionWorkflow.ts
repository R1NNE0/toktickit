import { actionError, actionInteger, actionText, MAX_ACTION_INT, validateActionContent,
  type ActionContent, type CreateActionInput, type EditActionInput, type TransitionActionInput } from "./actionValidation.js";

export type ActionStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type ActionOperation = "CREATE" | "EDIT" | "REASSIGN" | "START" | "COMPLETE" | "CANCEL";
export type EligibleUser = { id: number; role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR"; isActive: boolean };
export type ActionRecord = ActionContent & {
  ticketId: number; cycle: number; status: ActionStatus; createdById: number; performedById: number | null;
  createdAt: Date; updatedAt: Date; completedAt: Date | null; cancelledAt: Date | null;
  cancellationReason: string | null; version: number;
};
export type ActionContext = {
  actor: EligibleUser;
  // The adapter supplies a freshly read target/current assignee where different from actor.
  assignee?: EligibleUser;
  parent: { id: number; currentStatus: string; workCycle: number; workflowVersion: number };
  now: Date;
};
export type ActionPlan = { action: ActionRecord; changed: boolean; operation: ActionOperation | null; changeReason: string | null };
const active = new Set(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"]);
const edges: Record<ActionStatus, readonly ActionStatus[]> = {
  PLANNED: ["IN_PROGRESS", "CANCELLED"], IN_PROGRESS: ["COMPLETED", "CANCELLED"], COMPLETED: [], CANCELLED: [],
};
export const canTransitionAction = (from: ActionStatus, to: ActionStatus): boolean => edges[from]?.includes(to) ?? false;
const eligible = (user: EligibleUser | undefined): boolean => !!user?.isActive && ["IT_STAFF", "ADMINISTRATOR"].includes(user.role);
function userFor(id: number, ctx: ActionContext): EligibleUser | undefined {
  return ctx.assignee?.id === id ? ctx.assignee : ctx.actor.id === id ? ctx.actor : undefined;
}
function guards(ctx: ActionContext, expectedWorkflowVersion: number, current?: ActionRecord, expectedVersion?: number) {
  if (!eligible(ctx.actor)) actionError(403, "FORBIDDEN", "Actions require active IT Staff or Administrator access.");
  if (current && current.ticketId !== ctx.parent.id) actionError(404, "NOT_FOUND", "Action not found.");
  if (ctx.parent.workflowVersion !== expectedWorkflowVersion) actionError(409, "TICKET_VERSION_CONFLICT", "Ticket changed. Reload before retrying.");
  if (current && current.version !== expectedVersion) actionError(409, "ACTION_VERSION_CONFLICT", "Action changed. Reload before retrying.");
  if (current && current.cycle !== ctx.parent.workCycle) actionError(409, "TICKET_CYCLE_CONFLICT", "Action belongs to an earlier work cycle.");
  if (!active.has(ctx.parent.currentStatus)) actionError(409, "TICKET_NOT_ACTIVE", "Ticket is no longer active.");
}
function increment(version: number): number {
  actionInteger(version, "version");
  if (version === MAX_ACTION_INT) actionError(500, "INTERNAL_ERROR", "Unable to advance the workflow version.");
  return version + 1;
}
function changed(action: ActionRecord, ctx: ActionContext, operation: ActionOperation, changeReason: string | null): ActionPlan {
  increment(ctx.parent.workflowVersion); // Ensure parent can advance before any caller persists work.
  return { action: { ...action, version: increment(action.version), updatedAt: ctx.now }, changed: true, operation, changeReason };
}
// These functions return plans only. The future adapter must lock/re-read and
// persist the action, revision and parent increment in one transaction.
// Exact create replay is handled by that adapter BEFORE calling this new-write plan.
export function planCreateAction(input: CreateActionInput, ctx: ActionContext): ActionPlan {
  guards(ctx, input.expectedWorkflowVersion);
  if (!eligible(userFor(input.assigneeId, ctx))) actionError(400, "INELIGIBLE_ASSIGNEE", "Select an active eligible assignee.");
  validateActionContent(input);
  increment(ctx.parent.workflowVersion);
  const { description, result, assigneeId, followUpRequired, followUpNote, attachmentNotes } = input;
  return { changed: true, operation: "CREATE", changeReason: null, action: {
    description, result, assigneeId, followUpRequired, followUpNote, attachmentNotes,
    ticketId: ctx.parent.id, cycle: ctx.parent.workCycle, status: "PLANNED", createdById: ctx.actor.id,
    performedById: null, createdAt: ctx.now, updatedAt: ctx.now, completedAt: null, cancelledAt: null,
    cancellationReason: null, version: 1,
  } };
}
export function planEditAction(current: ActionRecord, input: EditActionInput, ctx: ActionContext): ActionPlan {
  guards(ctx, input.expectedWorkflowVersion, current, input.expectedVersion);
  if (current.status === "CANCELLED") actionError(409, "ACTION_READ_ONLY", "Cancelled Actions are read-only.");
  if (current.status === "COMPLETED" && Object.hasOwn(input, "assigneeId"))
    actionError(400, "VALIDATION_ERROR", "Completed Action assignment is immutable.");
  const { expectedVersion: _a, expectedWorkflowVersion: _t, changeReason, ...fields } = input;
  const next = { ...current, ...fields };
  validateActionContent(next, current.status === "COMPLETED");
  const reassigned = next.assigneeId !== current.assigneeId;
  if (reassigned && !eligible(userFor(next.assigneeId, ctx))) actionError(400, "INELIGIBLE_ASSIGNEE", "Select an active eligible assignee.");
  const differs = (Object.keys(fields) as (keyof ActionContent)[]).some(key => next[key] !== current[key]);
  if (!differs) return { action: { ...current }, changed: false, operation: null, changeReason: null };
  if (current.status === "COMPLETED") actionText(changeReason, "changeReason", 4000, true);
  return changed(next, ctx, reassigned ? "REASSIGN" : "EDIT", changeReason ?? null);
}
export function planActionTransition(current: ActionRecord, input: TransitionActionInput, ctx: ActionContext): ActionPlan {
  guards(ctx, input.expectedWorkflowVersion, current, input.expectedVersion);
  if (!canTransitionAction(current.status, input.targetStatus)) actionError(409, "INVALID_TRANSITION", "Action transition is not permitted.");
  if (input.targetStatus !== "CANCELLED") {
    if (!eligible(userFor(current.assigneeId, ctx))) actionError(409, "ACTION_ASSIGNEE_UNAVAILABLE", "Reassign this Action to an eligible account.");
    if (ctx.actor.id !== current.assigneeId) actionError(403, "ACTION_ASSIGNEE_REQUIRED", "Only the current assignee may start or complete work.");
  }
  if (input.targetStatus === "IN_PROGRESS") return changed({ ...current, status: "IN_PROGRESS" }, ctx, "START", null);
  if (input.targetStatus === "CANCELLED") return changed({ ...current, status: "CANCELLED", cancelledAt: ctx.now,
    cancellationReason: input.reason, performedById: null, completedAt: null }, ctx, "CANCEL", input.reason);
  const next: ActionRecord = { ...current, status: "COMPLETED", result: input.result, followUpRequired: input.followUpRequired,
    followUpNote: input.followUpNote === undefined ? current.followUpNote : input.followUpNote,
    attachmentNotes: input.attachmentNotes === undefined ? current.attachmentNotes : input.attachmentNotes,
    performedById: ctx.actor.id, completedAt: ctx.now,
  };
  validateActionContent(next, true);
  return changed(next, ctx, "COMPLETE", null);
}
