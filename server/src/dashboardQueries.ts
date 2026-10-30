import { Prisma } from "@prisma/client";
import { reject } from "./auth/http.js";

export const activeStatuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const;
// Fixed aliases shared by the dashboard and the paginated outstanding-Action API.
export const outstandingPredicate = (userId: number) => Prisma.sql`a."assigneeId"=${userId}
  AND a.status IN ('PLANNED','IN_PROGRESS') AND a.cycle=t."workCycle"
  AND t."currentStatus"::text IN (${Prisma.join(activeStatuses)})`;

export function dashboardFilters(query: Record<string, unknown>) {
  const { statusGroup, updatedFrom, updatedTo, resolvedFrom, resolvedTo, ...common } = query;
  const invalid = (): never => reject(400, "INVALID_QUERY", "Invalid ticket query parameters.");
  if (statusGroup !== undefined && (typeof statusGroup !== "string" || !["active", "resolved"].includes(statusGroup)
    || common.status !== undefined || common.currentStatus !== undefined)) invalid();
  const instant = (value: unknown) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return invalid();
    const date = new Date(value);
    // Date.parse otherwise silently normalizes dates such as February 30.
    const day = value.slice(0, 10), calendar = new Date(day + "T00:00:00Z");
    if (!Number.isFinite(date.getTime()) || !Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day) invalid();
    return date;
  };
  const range = (from: unknown, to: unknown) => {
    if (from === undefined && to === undefined) return undefined;
    const start = instant(from), end = instant(to);
    if (start >= end) invalid();
    return { from: start, to: end };
  };
  const updated = range(updatedFrom, updatedTo), resolved = range(resolvedFrom, resolvedTo);
  if (resolved && statusGroup !== "resolved" && !["RESOLVED", "CLOSED"].includes(String(common.status ?? common.currentStatus))) invalid();
  return { common, statusGroup, updated, resolved };
}
