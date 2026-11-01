import { authFetch, ApiError, type TicketStatus, type PaginationMeta, type Assignee } from "./api.js";
export type ListFilters = { status?: TicketStatus; statusGroup?: "active" | "resolved"; ownerId?: "unassigned" | "me";
  itPriority?: string; updatedFrom?: string; updatedTo?: string; resolvedFrom?: string; resolvedTo?: string;
  sortBy?: "createdAt" | "updatedAt"; sortOrder?: "asc" | "desc" };
export type Drilldown = { view: "staff-queue"; filters: ListFilters } | { view: "my-actions"; filters: { assigneeId: "me"; state: "outstanding" } };
export type ActionSummary = { id: number; ticketId: number; cycle: number; status: "PLANNED" | "IN_PROGRESS"; descriptionExcerpt: string; createdAt: string;
  ticket: { id: number; ticketNumber: string; summary: string; currentStatus: TicketStatus } };
export type StaffDashboardData = { generatedAt: string; timezone: "Asia/Bangkok"; recentWindow: { from: string; to: string };
  recentTickets: { id: number; ticketNumber: string; summary: string; currentStatus: TicketStatus; requestedPriority: string; itPriority: string;
    owner: Assignee | null; updatedAt: string; resolvedAt: string | null }[];
  metrics: { unassignedActiveTickets: number; myActiveTickets: number; ticketsByStatus: Record<TicketStatus, number>;
    activeTicketsByItPriority: Record<string, number>; myOutstandingActions: number };
  myActions: { total: number; items: ActionSummary[] };
  drilldowns: { unassignedActiveTickets: Drilldown; myActiveTickets: Drilldown; ticketsByStatus: Record<TicketStatus, Drilldown>;
    activeTicketsByItPriority: Record<string, Drilldown>; myOutstandingActions: Drilldown; recentTickets: Drilldown } };
async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await authFetch(path, { signal });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.code ?? "ERROR", data?.error ?? "Unable to load dashboard data.");
  if (!data) throw new Error("Unable to read dashboard response.");
  return data;
}
export const getStaffDashboard = (signal?: AbortSignal) => read<StaffDashboardData>("/api/dashboard/staff", signal);
export const getMyActions = (page: number, signal?: AbortSignal) => read<{ data: ActionSummary[]; pagination: PaginationMeta }>(
  `/api/staff/actions?assigneeId=me&state=outstanding&page=${page}&pageSize=10`, signal);
