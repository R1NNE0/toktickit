import { createHash } from "node:crypto";

// Pure domain errors: the future HTTP adapter must explicitly project these
// approved fields. This module performs no authentication or database access.
export class ActionRuleError extends Error {
  constructor(public status: number, public code: string, message: string,
    public fields?: Record<string, string>) { super(message); }
}
export function actionError(status: number, code: string, message: string): never {
  throw new ActionRuleError(status, code, message);
}
const invalid = (message: string, field?: string): never => {
  throw new ActionRuleError(400, "VALIDATION_ERROR", message, field ? { [field]: message } : undefined);
};
export const MAX_ACTION_INT = 2147483647;
export function actionInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_ACTION_INT)
    invalid(`${field} must be a positive 32-bit integer.`, field);
  return value as number;
}
function object(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some(key => !allowed.includes(key))) invalid("Unexpected or server-owned fields.");
  return value as Record<string, unknown>;
}
export function actionText(value: unknown, field: string, max: number, required = false): string | null {
  if (value === null && !required) return null;
  if (typeof value !== "string") invalid(`${field} must be text${required ? "" : " or null"}.`, field);
  const text = (value as string).trim();
  if ([...text].length > max || (required && !text)) invalid(`${field} has an invalid length.`, field);
  return text || null;
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") invalid("followUpRequired must be a boolean.", "followUpRequired");
  return value as boolean;
}
const contentKeys = ["description", "result", "assigneeId", "followUpRequired", "followUpNote", "attachmentNotes"] as const;
export type ActionContent = {
  description: string; result: string | null; assigneeId: number;
  followUpRequired: boolean; followUpNote: string | null; attachmentNotes: string | null;
};
export type CreateActionInput = ActionContent & { clientRequestId: string; expectedWorkflowVersion: number };
export type EditActionInput = Partial<ActionContent> & {
  expectedVersion: number; expectedWorkflowVersion: number; changeReason?: string;
};
type Versions = { expectedVersion: number; expectedWorkflowVersion: number };
export type TransitionActionInput = Versions & (
  { targetStatus: "IN_PROGRESS" }
  | { targetStatus: "COMPLETED"; result: string; followUpRequired: boolean; followUpNote?: string | null; attachmentNotes?: string | null }
  | { targetStatus: "CANCELLED"; confirmed: true; reason: string }
);
function content(body: Record<string, unknown>): Partial<ActionContent> {
  const out: Partial<ActionContent> = {};
  if (Object.hasOwn(body, "description")) out.description = actionText(body.description, "description", 4000, true)!;
  if (Object.hasOwn(body, "result")) out.result = actionText(body.result, "result", 4000);
  if (Object.hasOwn(body, "assigneeId")) out.assigneeId = actionInteger(body.assigneeId, "assigneeId");
  if (Object.hasOwn(body, "followUpRequired")) out.followUpRequired = boolean(body.followUpRequired);
  if (Object.hasOwn(body, "followUpNote")) out.followUpNote = actionText(body.followUpNote, "followUpNote", 2000);
  if (Object.hasOwn(body, "attachmentNotes")) out.attachmentNotes = actionText(body.attachmentNotes, "attachmentNotes", 2000);
  return out;
}
export function validateActionContent(value: ActionContent, completed = false): void {
  actionText(value.description, "description", 4000, true);
  actionText(value.result, "result", 4000, completed);
  actionInteger(value.assigneeId, "assigneeId");
  boolean(value.followUpRequired);
  actionText(value.followUpNote, "followUpNote", 2000, value.followUpRequired);
  actionText(value.attachmentNotes, "attachmentNotes", 2000);
}
export function parseCreateAction(value: unknown, creatorId: number): CreateActionInput {
  const body = object(value, [...contentKeys, "clientRequestId", "expectedWorkflowVersion"]);
  if (typeof body.clientRequestId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.clientRequestId)) invalid("clientRequestId must be a canonical UUID.", "clientRequestId");
  const normalized: CreateActionInput = {
    description: actionText(body.description, "description", 4000, true)!,
    assigneeId: actionInteger(creatorId, "creatorId"), result: null,
    followUpRequired: false, followUpNote: null, attachmentNotes: null,
    ...content(body), clientRequestId: (body.clientRequestId as string).toLowerCase(),
    expectedWorkflowVersion: actionInteger(body.expectedWorkflowVersion, "expectedWorkflowVersion"),
  };
  validateActionContent(normalized);
  return normalized;
}
export function parseEditAction(value: unknown): EditActionInput {
  const body = object(value, [...contentKeys, "expectedVersion", "expectedWorkflowVersion", "changeReason"]);
  if (!contentKeys.some(key => Object.hasOwn(body, key))) invalid("Provide at least one editable field.");
  return { ...content(body),
    expectedVersion: actionInteger(body.expectedVersion, "expectedVersion"),
    expectedWorkflowVersion: actionInteger(body.expectedWorkflowVersion, "expectedWorkflowVersion"),
    ...(Object.hasOwn(body, "changeReason") ? { changeReason: actionText(body.changeReason, "changeReason", 4000, true)! } : {}),
  };
}
export function parseTransitionAction(value: unknown): TransitionActionInput {
  const initial = object(value, ["targetStatus", "expectedVersion", "expectedWorkflowVersion", "result", "followUpRequired", "followUpNote", "attachmentNotes", "confirmed", "reason"]);
  const common = ["targetStatus", "expectedVersion", "expectedWorkflowVersion"];
  const versions = { expectedVersion: actionInteger(initial.expectedVersion, "expectedVersion"),
    expectedWorkflowVersion: actionInteger(initial.expectedWorkflowVersion, "expectedWorkflowVersion") };
  switch (initial.targetStatus) {
    case "IN_PROGRESS": object(value, common); return { ...versions, targetStatus: "IN_PROGRESS" };
    case "CANCELLED": {
      object(value, [...common, "confirmed", "reason"]);
      if (initial.confirmed !== true) invalid("Cancellation requires explicit confirmation.", "confirmed");
      return { ...versions, targetStatus: "CANCELLED", confirmed: true, reason: actionText(initial.reason, "reason", 4000, true)! };
    }
    case "COMPLETED": {
      object(value, [...common, "result", "followUpRequired", "followUpNote", "attachmentNotes"]);
      return { ...versions, targetStatus: "COMPLETED", result: actionText(initial.result, "result", 4000, true)!,
        followUpRequired: boolean(initial.followUpRequired),
        ...(Object.hasOwn(initial, "followUpNote") ? { followUpNote: actionText(initial.followUpNote, "followUpNote", 2000) } : {}),
        ...(Object.hasOwn(initial, "attachmentNotes") ? { attachmentNotes: actionText(initial.attachmentNotes, "attachmentNotes", 2000) } : {}),
      };
    }
    default: return invalid("Invalid Action target status.", "targetStatus");
  }
}
// Input must come from parseCreateAction: normalization precedes fingerprinting.
export function creationFingerprint(ticketId: number, input: CreateActionInput): string {
  actionInteger(ticketId, "ticketId");
  return createHash("sha256").update(JSON.stringify({ ticketId, description: input.description,
    assigneeId: input.assigneeId, result: input.result, followUpRequired: input.followUpRequired,
    followUpNote: input.followUpNote, attachmentNotes: input.attachmentNotes }), "utf8").digest("hex");
}
