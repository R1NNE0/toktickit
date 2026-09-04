const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const REQUESTER_STORAGE_KEY = "toktickit_selected_requester_id";

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

export interface RequesterUser {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export interface HealthResponse {
  status: string;
  service: string;
}

// ---------------------------------------------------------------------------
// Storage Helpers
// ---------------------------------------------------------------------------
export function getStoredRequesterId(): number | null {
  const val = localStorage.getItem(REQUESTER_STORAGE_KEY);
  if (!val) return null;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? null : parsed;
}

export function setStoredRequesterId(id: number | null): void {
  if (id === null) {
    localStorage.removeItem(REQUESTER_STORAGE_KEY);
  } else {
    localStorage.setItem(REQUESTER_STORAGE_KEY, id.toString());
  }
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

export async function getActiveRequesters(): Promise<RequesterUser[]> {
  const res = await fetch(`${API_URL}/api/requesters/active`);
  if (!res.ok) {
    throw new Error(`Failed to fetch active requesters with status ${res.status}`);
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
 * Authenticated fetch helper: automatically injects `x-requester-id` header.
 */
export async function authFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const requesterId = getStoredRequesterId();
  const headers = new Headers(options.headers || {});

  if (requesterId) {
    headers.set("x-requester-id", requesterId.toString());
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`;
  return fetch(url, {
    ...options,
    headers,
  });
}

// Legacy helper for Lab 1 tests & compatibility
export async function checkSystem(): Promise<SystemStatus> {
  await getHealthStatus();
  const categories = await getCategories();
  return { online: true, categories };
}
