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
export type TicketStatus = "NEW" | "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

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
