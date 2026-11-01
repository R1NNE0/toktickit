import type { CurrentUser } from "./auth-client.js";
import type { ActionRecord, ActionTicket, ActionUser } from "./actions-api.js";
export type ActionMode = "create" | "edit" | "start" | "complete" | "cancel" | "history";
export type ActionFields = { description: string; result: string; assigneeId: string; followUpRequired: boolean; followUpNote: string; attachmentNotes: string; reason: string };
export const eligible = (user: ActionUser) => user.isActive && ["IT_STAFF", "ADMINISTRATOR"].includes(user.role);
export function actionAllowed(mode: ActionMode, user: CurrentUser, ticket: Pick<ActionTicket, "currentStatus" | "workCycle">, action?: ActionRecord) {
  if (!eligible(user) || user.mustChangePassword) return false;
  if (mode === "history") return true;
  if (!["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].includes(ticket.currentStatus)) return false;
  if (mode === "create") return true;
  if (!action || action.cycle !== ticket.workCycle || action.status === "CANCELLED") return false;
  if (mode === "edit") return true;
  if (mode === "cancel") return ["PLANNED", "IN_PROGRESS"].includes(action.status);
  return eligible(action.assignee) && action.assignee.id === user.id && action.status === (mode === "start" ? "PLANNED" : "IN_PROGRESS");
}
export function initialActionFields(userId: number, action?: ActionRecord): ActionFields {
  return { description: action?.description ?? "", result: action?.result ?? "", assigneeId: String(action?.assignee.id ?? userId),
    followUpRequired: action?.followUpRequired ?? false, followUpNote: action?.followUpNote ?? "", attachmentNotes: action?.attachmentNotes ?? "", reason: "" };
}
export function validateActionFields(mode: ActionMode, fields: ActionFields, completed: boolean) {
  const errors: Record<string, string> = {};
  const text = (key: keyof ActionFields, max: number, required = false) => {
    const value = String(fields[key]).trim();
    if ((required && !value) || [...value].length > max) errors[key] = required ? `Enter 1–${max} characters.` : `Use at most ${max} characters.`;
  };
  if (["create", "edit"].includes(mode)) text("description", 4000, true);
  if (["create", "edit", "complete"].includes(mode)) {
    text("result", 4000, mode === "complete" || completed);
    text("followUpNote", 2000, fields.followUpRequired); text("attachmentNotes", 2000);
    if (mode !== "complete" && !completed && (!/^[1-9]\d*$/.test(fields.assigneeId) || Number(fields.assigneeId) > 2147483647)) errors.assigneeId = "Select an eligible assignee.";
  }
  if (mode === "cancel" || (mode === "edit" && completed)) text("reason", 4000, true);
  else if (mode === "edit" && fields.reason.trim()) text("reason", 4000);
  return errors;
}
export const actionDate = (value: string | null) => value ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not recorded";
export const actionLabel = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/^./, c => c.toUpperCase());

// Detail, header and hash navigation share one cancellable guard. Auth expiry and
// logout deliberately bypass it so private drafts never survive an auth boundary.
export function canLeaveActions() { return window.dispatchEvent(new Event("toktickit:leave-actions", { cancelable: true })); }
