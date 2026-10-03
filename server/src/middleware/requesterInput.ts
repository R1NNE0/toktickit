import { Priority, TicketStatus } from "@prisma/client";
import { reject } from "../auth/http.js";

export function positiveId(value: unknown, label: string): number {
  if (!((typeof value === "string" && /^[1-9]\d*$/.test(value)) || (typeof value === "number" && Number.isInteger(value)))
    || Number(value) < 1 || Number(value) > 2147483647)
    reject(400, "INVALID_ID", `Invalid ${label} ID`);
  return Number(value);
}
export function bodyFields(body: unknown, allowed: string[]): asserts body is Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key)))
    reject(400, "VALIDATION_ERROR", "Unexpected or server-owned request fields.");
}
export function requesterQuery(query: Record<string, unknown>) {
  const keys = ["search", "categoryId", "status", "currentStatus", "priority", "requestedPriority", "sortBy", "sortOrder", "page", "pageSize", "limit"];
  const invalid = (): never => reject(400, "INVALID_QUERY", "Invalid ticket query parameters.");
  if (Object.keys(query).some(key => !keys.includes(key) || typeof query[key] !== "string")) invalid();
  const scalar = (key: string) => query[key] as string | undefined;
  const alias = (a: string, b: string) => {
    if (scalar(a) !== undefined && scalar(b) !== undefined && scalar(a) !== scalar(b)) invalid();
    return scalar(a) ?? scalar(b);
  };
  const number = (value: string) => {
    if (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647) invalid();
    return Number(value);
  };
  const page = number(scalar("page") ?? "1"), pageSize = number(alias("pageSize", "limit") ?? "10");
  if (![5, 8, 10, 20, 50].includes(pageSize) || (page - 1) * pageSize > 2147483647) invalid();
  const status = alias("status", "currentStatus"), priority = alias("priority", "requestedPriority");
  if (status !== undefined && !Object.values(TicketStatus).includes(status as TicketStatus)) invalid();
  if (priority !== undefined && !Object.values(Priority).includes(priority as Priority)) invalid();
  const sortBy = scalar("sortBy") ?? "createdAt", sortOrder = scalar("sortOrder") ?? "desc";
  if (!["createdAt", "updatedAt", "ticketNumber", "requestedPriority", "currentStatus"].includes(sortBy)
    || !["asc", "desc"].includes(sortOrder)) invalid();
  const search = (scalar("search") ?? "").trim();
  if ([...search].length > 200) invalid();
  return { page, pageSize, status, priority, sortBy, sortOrder: sortOrder as "asc" | "desc", search,
    categoryId: scalar("categoryId") === undefined ? undefined : number(scalar("categoryId")!) };
}
