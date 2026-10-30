import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { StaffDashboard } from "../../src/components/StaffDashboard.js";
import * as api from "../../src/staff-dashboard-api.js";
import { ApiError } from "../../src/api.js";

const queue = (filters = {}): api.Drilldown => ({ view: "staff-queue", filters });
export const emptyDashboard = (): api.StaffDashboardData => ({ generatedAt: "2026-10-08T00:00:00Z", timezone: "Asia/Bangkok",
  recentWindow: { from: "2026-10-01T00:00:00Z", to: "2026-10-08T00:00:00Z" }, recentTickets: [],
  metrics: { unassignedActiveTickets: 0, myActiveTickets: 0, myOutstandingActions: 0,
    ticketsByStatus: Object.fromEntries(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"].map(k => [k, 0])) as any,
    activeTicketsByItPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } }, myActions: { total: 0, items: [] },
  drilldowns: { unassignedActiveTickets: queue({ statusGroup: "active", ownerId: "unassigned" }), myActiveTickets: queue({ statusGroup: "active", ownerId: "me" }),
    myOutstandingActions: { view: "my-actions", filters: { assigneeId: "me", state: "outstanding" } },
    ticketsByStatus: Object.fromEntries(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"].map(status => [status, queue({ status })])) as any,
    activeTicketsByItPriority: Object.fromEntries(["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(itPriority => [itPriority, queue({ statusGroup: "active", itPriority })])),
    recentTickets: queue({ updatedFrom: "2026-10-01T00:00:00Z", updatedTo: "2026-10-08T00:00:00Z", sortBy: "updatedAt", sortOrder: "desc" }) } });
beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(api, "getStaffDashboard").mockResolvedValue(emptyDashboard()); });
it.each(["IT_STAFF", "ADMINISTRATOR"] as const)("renders all zero buckets and usable descriptors for %s", async role => {
  const navigate = vi.fn(); render(<StaffDashboard role={role} onDrilldown={navigate} onOpenTicket={vi.fn()} />);
  expect(screen.getByText("Loading dashboard...")).toBeInTheDocument();
  await screen.findByText("No recently updated Tickets.");
  expect(screen.getAllByRole("button", { name: / 0$/ })).toHaveLength(15);
  fireEvent.click(screen.getByRole("button", { name: "My active Tickets 0" }));
  expect(navigate).toHaveBeenLastCalledWith(queue({ statusGroup: "active", ownerId: "me" }));
  fireEvent.click(screen.getByRole("button", { name: "View all recent Tickets" }));
  expect(navigate).toHaveBeenLastCalledWith(emptyDashboard().drilldowns.recentTickets);
});
it("shows failure rather than zero and retries ordinary errors but not forbidden errors", async () => {
  vi.mocked(api.getStaffDashboard).mockRejectedValueOnce(new Error("offline"));
  render(<StaffDashboard role="IT_STAFF" onDrilldown={vi.fn()} onOpenTicket={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Counts are unavailable");
  expect(screen.queryByText("No recently updated Tickets.")).not.toBeInTheDocument();
  vi.mocked(api.getStaffDashboard).mockRejectedValueOnce(new ApiError(403, "FORBIDDEN", "Denied"));
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Access denied"));
  expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
});
it("discards a delayed old response after refresh", async () => {
  let resolve!: (value: api.StaffDashboardData) => void;
  vi.mocked(api.getStaffDashboard).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  render(<StaffDashboard role="IT_STAFF" onDrilldown={vi.fn()} onOpenTicket={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Refresh Dashboard" }));
  await screen.findByText("No recently updated Tickets.");
  const old = emptyDashboard(); old.metrics.myActiveTickets = 99;
  await act(async () => resolve(old));
  expect(screen.getByRole("button", { name: "My active Tickets 0" })).toBeInTheDocument();
});
it("loads the full assigned-work list and opens the exact parent/action", async () => {
  vi.spyOn(api, "getMyActions").mockResolvedValue({ data: [{ id: 8, ticketId: 20, cycle: 2, status: "PLANNED", descriptionExcerpt: "Work",
    createdAt: "2026-10-01T00:00:00Z", ticket: { id: 20, ticketNumber: "TKT-20", summary: "Network", currentStatus: "REOPENED" } }],
    pagination: { total: 1, totalItems: 1, page: 1, currentPage: 1, pageSize: 10, limit: 10, totalPages: 1 } });
  const open = vi.fn(); render(<StaffDashboard role="ADMINISTRATOR" onDrilldown={vi.fn()} onOpenTicket={open} />);
  fireEvent.click(await screen.findByRole("button", { name: "View all my outstanding Actions" }));
  fireEvent.click(await screen.findByRole("button", { name: "Action #8 / TKT-20" }));
  expect(open).toHaveBeenCalledWith(20, 8); expect(api.getMyActions).toHaveBeenCalledWith(1, expect.any(AbortSignal));
  expect(screen.getByRole("button", { name: "Next Actions page" })).toBeDisabled();
});
