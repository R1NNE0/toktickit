import { sessionFetch } from "./auth-client.js";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
  isActive?: boolean;
}

export interface RelatedSystem {
  id: number;
  name: string;
  isActive?: boolean;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export interface HealthResponse {
  status: string;
  service: string;
}

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TicketStatus = "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";

export interface Attachment {
  id: number;
  ticketId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  isRemoved: boolean;
  removedAt?: string | null;
  removalReason?: string | null;
  createdAt: string;
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  requestedPriority: Priority;
  itPriority: Priority;
  currentStatus: TicketStatus;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  createdAt: string;
  updatedAt: string;
  category?: { id: number; name: string };
  relatedSystem?: { id: number; name: string };
  requester?: { id: number; name: string; email: string };
  attachments?: Attachment[];
  attachmentCount?: number;
}

export interface CreateTicketPayload {
  summary: string;
  description: string;
  categoryId: number;
  relatedSystemId: number;
  requestedPriority?: Priority;
  idempotencyKey?: string;
}

export interface GetTicketsParams {
  search?: string;
  status?: string;
  categoryId?: number;
  priority?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  currentPage?: number;
  limit?: number;
  total?: number;
}

export interface PaginatedTicketsResponse {
  data: Ticket[];
  pagination: PaginationMeta;
}

export interface StaffTicketRow extends Ticket {
  requester: { id: number; name: string; email: string };
  ownerId: number | null;
  owner: { id: number; name: string; role: "IT_STAFF" | "ADMINISTRATOR"; isActive: boolean } | null;
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  attachmentCount: number;
  resolutionSuggestedAt: string | null;
  resolutionSuggestedById: number | null;
}

export interface StaffTicketDetail extends Ticket {
  requester: { id: number; name: string; email: string };
  ownerId: number | null;
  owner: { id: number; name: string; role: "IT_STAFF" | "ADMINISTRATOR"; isActive: boolean } | null;
  attachments: Attachment[];
  attachmentCount: number;
  resolutionSuggestedAt: string | null;
  resolutionSuggestedById: number | null;
}

export interface Assignee {
  id: number;
  name: string;
  role: "IT_STAFF" | "ADMINISTRATOR";
  isActive: boolean;
}

export interface PublicComment {
  id: number;
  ticketId: number;
  body: string;
  author: { id: number; name: string };
  createdAt: string;
}

export interface InternalNote {
  id: number;
  ticketId: number;
  body: string;
  author: { id: number; name: string };
  createdAt: string;
}

export interface PaginatedEntriesResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ResolutionIndicationResponse {
  ticketId: number;
  currentStatus: TicketStatus;
  resolutionSuggestedAt: string;
  resolutionSuggestedById: number;
}

export interface StaffQueueParams extends GetTicketsParams {
  itPriority?: string;
  ownerId?: number | "unassigned";
}
export interface StaffQueueResponse { data: StaffTicketRow[]; pagination: PaginationMeta; }
export class QueueError extends Error {
  constructor(public status: number) {
    super(status === 403 ? "Access denied. Ticket Queue is available to IT Staff only."
      : status === 400 ? "Invalid queue filters. Check your query and try again."
      : "Unable to load the Ticket Queue. Please try again.");
  }
}
export async function getStaffTickets(params: StaffQueueParams, signal?: AbortSignal): Promise<StaffQueueResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== "ALL") query.set(key, String(value));
  }
  const res = await authFetch(`/api/staff/tickets?${query}`, { signal });
  if (!res.ok) throw new QueueError(res.status);
  return res.json();
}

// ---------------------------------------------------------------------------
// API Client Functions
// ---------------------------------------------------------------------------
export async function getHealthStatus(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return res.json();
}

export async function getCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/categories`);
  if (!res.ok) {
    throw new Error(`Failed to fetch categories with status ${res.status}`);
  }
  return res.json();
}

export async function getRelatedSystems(): Promise<RelatedSystem[]> {
  const res = await fetch(`${API_URL}/api/related-systems`);
  if (!res.ok) {
    throw new Error(`Failed to fetch related systems with status ${res.status}`);
  }
  return res.json();
}

/**
 * Authenticated fetch helper: sends the server session cookie and CSRF token.
 */
export async function authFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return sessionFetch(endpoint, options);
}

export async function createTicket(
  payload: CreateTicketPayload
): Promise<Ticket> {
  const res = await authFetch("/api/tickets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error ||
        (errorData.details && errorData.details[0]?.message) ||
        `Failed to create ticket with status ${res.status}`
    );
  }

  return res.json();
}

export async function uploadAttachment(
  ticketId: number,
  file: File,
  signal?: AbortSignal
): Promise<Attachment> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await authFetch(`/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    body: formData, signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to upload attachment with status ${res.status}`
    );
  }

  return res.json();
}

export async function getTickets(
  params: GetTicketsParams = {}
): Promise<PaginatedTicketsResponse> {
  const query = new URLSearchParams();
  if (params.search && params.search.trim()) {
    query.set("search", params.search.trim());
  }
  if (params.status && params.status !== "ALL") {
    query.set("status", params.status);
  }
  if (params.categoryId) {
    query.set("categoryId", params.categoryId.toString());
  }
  if (params.priority && params.priority !== "ALL") {
    query.set("priority", params.priority);
  }
  if (params.page !== undefined && params.page > 0) {
    query.set("page", params.page.toString());
  }
  if (params.pageSize !== undefined && params.pageSize > 0) {
    query.set("pageSize", params.pageSize.toString());
  }
  if (params.sortBy) {
    query.set("sortBy", params.sortBy);
  }
  if (params.sortOrder) {
    query.set("sortOrder", params.sortOrder);
  }

  const queryString = query.toString();
  const endpoint = `/api/tickets${queryString ? `?${queryString}` : ""}`;
  const res = await authFetch(endpoint);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to fetch tickets with status ${res.status}`
    );
  }

  return res.json();
}

export async function getTicketDetail(id: number): Promise<Ticket> {
  const res = await authFetch(`/api/tickets/${id}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to fetch ticket details with status ${res.status}`
    );
  }
  return res.json();
}

export async function downloadAttachment(
  attachmentId: number,
  fileName: string,
  signal?: AbortSignal
): Promise<void> {
  const res = await authFetch(`/api/attachments/${attachmentId}/download`, { signal });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to download attachment with status ${res.status}`
    );
  }

  const blob = await res.blob();
  signal?.throwIfAborted();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
}

export async function softRemoveAttachment(
  attachmentId: number,
  reason: string
): Promise<Attachment> {
  const res = await authFetch(`/api/attachments/${attachmentId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error ||
        `Failed to remove attachment with status ${res.status}`
    );
  }

  return res.json();
}

// Legacy helper for Lab 1 tests & compatibility
export async function checkSystem(): Promise<SystemStatus> {
  await getHealthStatus();
  const categories = await getCategories();
  return { online: true, categories };
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleApiResponse<T>(res: Response, defaultMessage: string): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData.error || (errorData.details && errorData.details[0]?.message) || `${defaultMessage} (status ${res.status})`;
    throw new ApiError(res.status, errorData.code || "ERROR", message);
  }
  return res.json();
}

export async function getStaffAssignees(signal?: AbortSignal): Promise<Assignee[]> {
  const res = await authFetch("/api/staff/assignees", { signal });
  return handleApiResponse<Assignee[]>(res, "Failed to fetch assignees");
}

export async function getStaffTicketDetail(id: number, signal?: AbortSignal): Promise<StaffTicketDetail> {
  const res = await authFetch(`/api/staff/tickets/${id}`, { signal });
  return handleApiResponse<StaffTicketDetail>(res, "Failed to fetch staff ticket detail");
}

export async function claimTicket(id: number): Promise<StaffTicketDetail> {
  const res = await authFetch(`/api/staff/tickets/${id}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return handleApiResponse<StaffTicketDetail>(res, "Failed to claim ticket");
}

export async function updateTicketOwner(id: number, ownerId: number | null): Promise<StaffTicketDetail> {
  const res = await authFetch(`/api/staff/tickets/${id}/owner`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerId }),
  });
  return handleApiResponse<StaffTicketDetail>(res, "Failed to update ticket owner");
}

export async function updateTicketPriority(id: number, itPriority: Priority): Promise<Ticket> {
  const res = await authFetch(`/api/staff/tickets/${id}/priority`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itPriority }),
  });
  return handleApiResponse<Ticket>(res, "Failed to update ticket priority");
}

export async function updateTicketStatus(
  id: number,
  payload: { currentStatus: TicketStatus; confirmed?: boolean; reason?: string }
): Promise<StaffTicketDetail> {
  const res = await authFetch(`/api/staff/tickets/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleApiResponse<StaffTicketDetail>(res, "Failed to update ticket status");
}

export async function getPublicComments(
  ticketId: number,
  params?: { page?: number; pageSize?: number },
  signal?: AbortSignal
): Promise<PaginatedEntriesResponse<PublicComment>> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  const res = await authFetch(`/api/tickets/${ticketId}/comments${qs ? `?${qs}` : ""}`, { signal });
  return handleApiResponse<PaginatedEntriesResponse<PublicComment>>(res, "Failed to fetch comments");
}

export async function createPublicComment(ticketId: number, body: string): Promise<PublicComment> {
  const res = await authFetch(`/api/tickets/${ticketId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  return handleApiResponse<PublicComment>(res, "Failed to create public comment");
}

export async function getInternalNotes(
  ticketId: number,
  params?: { page?: number; pageSize?: number },
  signal?: AbortSignal
): Promise<PaginatedEntriesResponse<InternalNote>> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  const res = await authFetch(`/api/tickets/${ticketId}/notes${qs ? `?${qs}` : ""}`, { signal });
  return handleApiResponse<PaginatedEntriesResponse<InternalNote>>(res, "Failed to fetch internal notes");
}

export async function createInternalNote(ticketId: number, body: string): Promise<InternalNote> {
  const res = await authFetch(`/api/tickets/${ticketId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  return handleApiResponse<InternalNote>(res, "Failed to create internal note");
}

export async function indicateResolution(ticketId: number): Promise<ResolutionIndicationResponse> {
  const res = await authFetch(`/api/tickets/${ticketId}/resolution-indication`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return handleApiResponse<ResolutionIndicationResponse>(res, "Failed to indicate resolution");
}

export type UserRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdminUserData {
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  initialPassword: string;
}

export interface UpdateAdminUserData {
  name?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

export async function getAdminUsers(
  params?: { search?: string; role?: UserRole },
  signal?: AbortSignal
): Promise<{ data: AdminUser[] }> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.role) query.set("role", params.role);
  const qs = query.toString();
  const res = await authFetch(`/api/admin/users${qs ? `?${qs}` : ""}`, { signal });
  return handleApiResponse<{ data: AdminUser[] }>(res, "Failed to fetch users");
}

export async function createAdminUser(data: CreateAdminUserData): Promise<AdminUser> {
  const res = await authFetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleApiResponse<AdminUser>(res, "Failed to create user");
}

export async function updateAdminUser(id: number, data: UpdateAdminUserData): Promise<AdminUser> {
  const res = await authFetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleApiResponse<AdminUser>(res, "Failed to update user");
}

export async function resetAdminUserInitialPassword(id: number, initialPassword: string): Promise<AdminUser> {
  const res = await authFetch(`/api/admin/users/${id}/initial-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initialPassword }),
  });
  return handleApiResponse<AdminUser>(res, "Failed to reset initial password");
}
