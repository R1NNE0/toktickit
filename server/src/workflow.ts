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
