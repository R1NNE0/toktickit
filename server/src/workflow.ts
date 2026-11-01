import { TicketStatus, Priority, UserRole } from "@prisma/client";
import { HttpError } from "./auth/http.js";

export const VALID_STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

export const VALID_PRIORITIES: Priority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

export interface TransitionRule {
  from: TicketStatus;
  to: TicketStatus;
  requiresOwner: boolean;
  requiresConfirmation: boolean;
  requiresReason: boolean;
  clearsResolution: boolean;
}

export const TRANSITION_MATRIX: Record<string, TransitionRule> = {
  "NEW->OPEN": { from: "NEW", to: "OPEN", requiresOwner: false, requiresConfirmation: false, requiresReason: false, clearsResolution: false },
  "NEW->CANCELLED": { from: "NEW", to: "CANCELLED", requiresOwner: false, requiresConfirmation: true, requiresReason: true, clearsResolution: false },
  "OPEN->IN_PROGRESS": { from: "OPEN", to: "IN_PROGRESS", requiresOwner: true, requiresConfirmation: false, requiresReason: false, clearsResolution: false },
  "OPEN->CANCELLED": { from: "OPEN", to: "CANCELLED", requiresOwner: false, requiresConfirmation: true, requiresReason: true, clearsResolution: false },
  "IN_PROGRESS->WAITING_FOR_REQUESTER": { from: "IN_PROGRESS", to: "WAITING_FOR_REQUESTER", requiresOwner: false, requiresConfirmation: false, requiresReason: false, clearsResolution: false },
  "IN_PROGRESS->RESOLVED": { from: "IN_PROGRESS", to: "RESOLVED", requiresOwner: true, requiresConfirmation: true, requiresReason: false, clearsResolution: false },
  "IN_PROGRESS->CANCELLED": { from: "IN_PROGRESS", to: "CANCELLED", requiresOwner: false, requiresConfirmation: true, requiresReason: true, clearsResolution: false },
  "WAITING_FOR_REQUESTER->IN_PROGRESS": { from: "WAITING_FOR_REQUESTER", to: "IN_PROGRESS", requiresOwner: true, requiresConfirmation: false, requiresReason: false, clearsResolution: false },
  "WAITING_FOR_REQUESTER->RESOLVED": { from: "WAITING_FOR_REQUESTER", to: "RESOLVED", requiresOwner: true, requiresConfirmation: true, requiresReason: false, clearsResolution: false },
  "WAITING_FOR_REQUESTER->CANCELLED": { from: "WAITING_FOR_REQUESTER", to: "CANCELLED", requiresOwner: false, requiresConfirmation: true, requiresReason: true, clearsResolution: false },
  "RESOLVED->CLOSED": { from: "RESOLVED", to: "CLOSED", requiresOwner: false, requiresConfirmation: true, requiresReason: false, clearsResolution: false },
  "RESOLVED->REOPENED": { from: "RESOLVED", to: "REOPENED", requiresOwner: false, requiresConfirmation: true, requiresReason: true, clearsResolution: true },
  "CLOSED->REOPENED": { from: "CLOSED", to: "REOPENED", requiresOwner: false, requiresConfirmation: true, requiresReason: true, clearsResolution: true },
  "REOPENED->OPEN": { from: "REOPENED", to: "OPEN", requiresOwner: false, requiresConfirmation: false, requiresReason: false, clearsResolution: false },
  "REOPENED->CANCELLED": { from: "REOPENED", to: "CANCELLED", requiresOwner: false, requiresConfirmation: true, requiresReason: true, clearsResolution: false },
};

export function getTransitionRule(from: TicketStatus, to: TicketStatus): TransitionRule | null {
  return TRANSITION_MATRIX[`${from}->${to}`] ?? null;
}

export type ResolutionBlockers = {
  eligibleOwner: boolean; completedActions: number; incompleteActions: number; outstandingFollowUps: number;
};
type TransitionBlocker = "OWNER_REQUIRED" | "COMPLETED_ACTION_REQUIRED" | "ACTIONS_INCOMPLETE" | "FOLLOW_UP_REQUIRED";
export function transitionBlockers(rule: TransitionRule, state: ResolutionBlockers): TransitionBlocker[] {
  const blockers: TransitionBlocker[] = [];
  if (rule.requiresOwner && !state.eligibleOwner) blockers.push("OWNER_REQUIRED");
  if (rule.to === "RESOLVED") {
    if (state.completedActions < 1) blockers.push("COMPLETED_ACTION_REQUIRED");
    if (state.incompleteActions > 0) blockers.push("ACTIONS_INCOMPLETE");
    if (state.outstandingFollowUps > 0) blockers.push("FOLLOW_UP_REQUIRED");
  } else if (rule.to === "CANCELLED" && state.incompleteActions > 0) blockers.push("ACTIONS_INCOMPLETE");
  return blockers;
}
export function transitionOptions(from: TicketStatus, role: UserRole, state: ResolutionBlockers) {
  if (role !== "IT_STAFF") return [];
  return Object.values(TRANSITION_MATRIX).filter(rule => rule.from === from).map(rule => {
    const blockers = transitionBlockers(rule, state);
    return { to: rule.to, requiresConfirmation: rule.requiresConfirmation, requiresReason: rule.requiresReason,
      enabled: blockers.length === 0, blockers };
  });
}

export function ticketMutationBody(body: unknown, fields: string[], counter = "expectedWorkflowVersion") {
  const invalid = (field: string): never => { throw new HttpError(400, "VALIDATION_ERROR", "Invalid Ticket mutation input.",
    { details: { fields: { [field]: "Supply a valid value for this operation." } } }); };
  if (!body || typeof body !== "object" || Array.isArray(body)) invalid(counter);
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(key => ![counter, ...fields].includes(key))) invalid("body");
  const version = input[counter];
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1 || version > 2147483647) invalid(counter);
  return version as number;
}

export function validateTextBody(body: unknown, fieldName = "Comment"): string {
  if (typeof body !== "string") {
    throw new HttpError(400, "VALIDATION_ERROR", `${fieldName} body must be a string.`);
  }
  const trimmed = body.trim();
  if (trimmed.length === 0 || [...trimmed].length > 4000) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} body must be between 1 and 4000 characters.`
    );
  }
  return trimmed;
}

export const ACTIVE_RESOLUTION_STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "REOPENED",
];

export const TERMINAL_RESOLUTION_STATUSES: TicketStatus[] = [
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
];
