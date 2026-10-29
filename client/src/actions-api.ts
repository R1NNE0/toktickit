import { authFetch, ApiError, type Assignee, type PaginationMeta, type Ticket, type TicketStatus } from "./api.js";

export type ActionStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type ActionUser = Omit<Assignee, "role"> & { role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR" };
export type ActionRecord = {
  id: number; ticketId: number; cycle: number; status: ActionStatus; description: string; result: string | null;
  assignee: ActionUser; createdBy: ActionUser; performedBy: ActionUser | null;
  followUpRequired: boolean; followUpNote: string | null; attachmentNotes: string | null;
  createdAt: string; updatedAt: string; completedAt: string | null; cancelledAt: string | null;
  cancellationReason: string | null; version: number;
};
export type ActionSnapshot = Omit<ActionRecord, "assignee" | "createdBy" | "performedBy"> & {
  assigneeId: number; createdById: number; performedById: number | null;
};
export type ActionRevision = { id: number; actionId: number; version: number;
  operation: "CREATE" | "EDIT" | "REASSIGN" | "START" | "COMPLETE" | "CANCEL";
  actor: ActionUser; occurredAt: string; changeReason: string | null; snapshot: ActionSnapshot };
export type ActionPage<T> = { data: T[]; pagination: PaginationMeta };
export type ActionTicket = Ticket & { workflowVersion: number; workCycle: number; currentStatus: TicketStatus };
export type ActionMutation = { action: ActionRecord; ticket: { id: number; workflowVersion: number; workCycle: number; updatedAt: string }; replayed: boolean };
export type CreateAction = { clientRequestId: string; expectedWorkflowVersion: number; description: string;
  assigneeId?: number; result?: string | null; followUpRequired?: boolean; followUpNote?: string | null; attachmentNotes?: string | null };
export type EditAction = Partial<Pick<CreateAction, "description" | "assigneeId" | "result" | "followUpRequired" | "followUpNote" | "attachmentNotes">>
  & { expectedWorkflowVersion: number; expectedVersion: number; changeReason?: string };
export type TransitionAction = { expectedWorkflowVersion: number; expectedVersion: number } & (
  { targetStatus: "IN_PROGRESS" } | { targetStatus: "COMPLETED"; result: string; followUpRequired: boolean; followUpNote?: string | null; attachmentNotes?: string | null }
  | { targetStatus: "CANCELLED"; confirmed: true; reason: string });

async function result<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await authFetch(path, options);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.code ?? "ERROR", data?.error ?? "Unable to complete the Actions request.",
    data?.details, data?.currentWorkflowVersion, data?.currentActionVersion, data?.currentCycle);
  if (data === null) throw new Error("Unable to read the server response. Reload or retry.");
  return data;
}
const path = (ticketId: number) => `/api/tickets/${ticketId}/actions`;
const body = (method: string, data: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
export function getTicketActions(ticketId: number, page = 1, pageSize = 20, signal?: AbortSignal) {
  return result<ActionPage<ActionRecord>>(`${path(ticketId)}?${new URLSearchParams({ page: String(page), pageSize: String(pageSize) })}`, { signal });
}
export function getAction(ticketId: number, actionId: number, signal?: AbortSignal) {
  return result<ActionRecord>(`${path(ticketId)}/${actionId}`, { signal });
}
export function getActionHistory(ticketId: number, actionId: number, page = 1, signal?: AbortSignal) {
  return result<ActionPage<ActionRevision>>(`${path(ticketId)}/${actionId}/history?page=${page}&pageSize=20`, { signal });
}
export function getActionTicket(ticketId: number, signal?: AbortSignal) {
  return result<ActionTicket>(`/api/tickets/${ticketId}`, { signal });
}
export function createAction(ticketId: number, data: CreateAction) { return result<ActionMutation>(path(ticketId), body("POST", data)); }
export function editAction(ticketId: number, actionId: number, data: EditAction) {
  return result<ActionMutation>(`${path(ticketId)}/${actionId}`, body("PATCH", data));
}
export function transitionAction(ticketId: number, actionId: number, data: TransitionAction) {
  return result<ActionMutation>(`${path(ticketId)}/${actionId}/transitions`, body("POST", data));
}
