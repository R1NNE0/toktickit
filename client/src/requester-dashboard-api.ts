import { authFetch, ApiError } from "./api.js";
import type { ListFilters, StaffDashboardData } from "./staff-dashboard-api.js";
export type RequesterFilters = Omit<ListFilters, "ownerId" | "itPriority">;
export type RequesterDrilldown = { view: "my-tickets"; filters: RequesterFilters };
export type RequesterDashboardData = Pick<StaffDashboardData, "generatedAt" | "timezone" | "recentWindow" | "recentTickets"> & {
  metrics: { activeTickets: number; waitingForYou: number; resolvedLast7Days: number; updatedLast7Days: number };
  drilldowns: Record<"activeTickets" | "waitingForYou" | "resolvedLast7Days" | "updatedLast7Days" | "recentTickets", RequesterDrilldown>;
};
export async function getRequesterDashboard(signal?: AbortSignal): Promise<RequesterDashboardData> {
  const response = await authFetch("/api/dashboard/requester", { signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data?.code ?? "ERROR", data?.error ?? "Unable to load dashboard.");
  if (!data) throw new Error("Unable to read dashboard response.");
  return data;
}
