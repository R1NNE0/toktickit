import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { RequesterDashboard } from "../../src/components/RequesterDashboard.js";
import * as api from "../../src/requester-dashboard-api.js";
import { ApiError } from "../../src/api.js";
const data = (): api.RequesterDashboardData => ({ generatedAt: "2030-01-08T00:00:00Z", timezone: "Asia/Bangkok",
  recentWindow: { from: "2030-01-01T00:00:00Z", to: "2030-01-08T00:00:00Z" }, recentTickets: [],
  metrics: { activeTickets: 0, waitingForYou: 0, resolvedLast7Days: 0, updatedLast7Days: 0 },
  drilldowns: { activeTickets: { view: "my-tickets", filters: { statusGroup: "active" } },
    waitingForYou: { view: "my-tickets", filters: { status: "WAITING_FOR_REQUESTER" } },
    resolvedLast7Days: { view: "my-tickets", filters: { statusGroup: "resolved", resolvedFrom: "2030-01-01T00:00:00Z", resolvedTo: "2030-01-08T00:00:00Z" } },
    updatedLast7Days: { view: "my-tickets", filters: { updatedFrom: "2030-01-01T00:00:00Z", updatedTo: "2030-01-08T00:00:00Z", sortBy: "updatedAt", sortOrder: "desc" } },
    recentTickets: { view: "my-tickets", filters: { updatedFrom: "2030-01-01T00:00:00Z", updatedTo: "2030-01-08T00:00:00Z", sortBy: "updatedAt", sortOrder: "desc" } } } });
beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(api, "getRequesterDashboard").mockResolvedValue(data()); });
it("shows real zero metrics, all exact descriptors, legacy guidance and Create Ticket", async () => {
  const drill = vi.fn(), create = vi.fn(); render(<RequesterDashboard onDrilldown={drill} onOpenTicket={vi.fn()} onCreate={create} />);
  expect(screen.getByText("Loading dashboard...")).toBeInTheDocument();
  await screen.findByText("No recently updated Tickets.");
  for (const [key, title] of Object.entries({ activeTickets: "Active tickets", waitingForYou: "Waiting for you", resolvedLast7Days: "Resolved in last 7 days", updatedLast7Days: "Updated in last 7 days" })) {
    fireEvent.click(screen.getByRole("button", { name: `${title} 0` }));
    expect(drill).toHaveBeenLastCalledWith(data().drilldowns[key as keyof api.RequesterDashboardData["drilldowns"]]);
  }
  expect(screen.getByText(/exclude older Tickets without a recorded resolution date/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Create a Ticket" })); expect(create).toHaveBeenCalledOnce();
});
it("shows recent status/activity without exposing staff controls, and opens the exact Ticket", async () => {
  const d = data(); d.metrics.activeTickets = 5; d.recentTickets = [{ id: 8, ticketNumber: "TKT-8", summary: "Reopened work", currentStatus: "REOPENED",
    requestedPriority: "LOW", itPriority: "HIGH", owner: null, updatedAt: d.generatedAt, resolvedAt: null }];
  vi.mocked(api.getRequesterDashboard).mockResolvedValue(d);
  const open = vi.fn(); render(<RequesterDashboard onDrilldown={vi.fn()} onOpenTicket={open} onCreate={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Open Ticket TKT-8" })); expect(open).toHaveBeenCalledWith(8);
  expect(screen.getByText(/REOPENED/)).toBeInTheDocument(); expect(screen.queryByText("My Actions")).not.toBeInTheDocument();
});
it("never replaces failure with zero, retries normal errors and distinguishes forbidden", async () => {
  vi.mocked(api.getRequesterDashboard).mockRejectedValueOnce(new Error("offline"));
  render(<RequesterDashboard onDrilldown={vi.fn()} onOpenTicket={vi.fn()} onCreate={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Counts are unavailable");
  expect(screen.queryByRole("button", { name: "Active tickets 0" })).not.toBeInTheDocument();
  vi.mocked(api.getRequesterDashboard).mockRejectedValueOnce(new ApiError(403, "FORBIDDEN", "Denied"));
  fireEvent.click(screen.getByRole("button", { name: "Retry Dashboard" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Access denied"));
  expect(screen.queryByRole("button", { name: "Retry Dashboard" })).not.toBeInTheDocument();
});
it("discards delayed responses after a refresh and after unmount", async () => {
  let resolve!: (d: api.RequesterDashboardData) => void;
  vi.mocked(api.getRequesterDashboard).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const view = render(<RequesterDashboard onDrilldown={vi.fn()} onOpenTicket={vi.fn()} onCreate={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Refresh Dashboard" })); await screen.findByText("No recently updated Tickets.");
  const old = data(); old.metrics.activeTickets = 99; await act(async () => resolve(old));
  expect(screen.getByRole("button", { name: "Active tickets 0" })).toBeInTheDocument();
  view.unmount(); expect(vi.mocked(api.getRequesterDashboard).mock.calls[1][0]?.aborted).toBe(true);
});
