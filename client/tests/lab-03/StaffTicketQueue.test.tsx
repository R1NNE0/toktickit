import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StaffTicketQueue } from "../../src/components/StaffTicketQueue.js";
import { Header } from "../../src/components/Header.js";
import * as api from "../../src/api.js";
import * as authClient from "../../src/auth-client.js";

const auth = vi.hoisted(() => ({ user: { id: 1, name: "Staff", role: "IT_STAFF", mustChangePassword: false }, logout: vi.fn() }));
vi.mock("../../src/context/AuthContext.js", () => ({ useAuth: () => auth }));
const row: api.StaffTicketRow = { id: 1, ticketNumber: "TKT-2026-100001", summary: "Network issue", description: "Queue description",
  requesterId: 3, requester: { id: 3, name: "Requester A", email: "a@example.com" }, categoryId: 1, category: { id: 1, name: "Network" },
  relatedSystemId: 2, relatedSystem: { id: 2, name: "Wi-Fi" }, requestedPriority: "HIGH", itPriority: "CRITICAL", currentStatus: "WAITING_FOR_REQUESTER",
  ownerId: 4, owner: { id: 4, name: "Owner A", role: "ADMINISTRATOR", isActive: true }, attachmentCount: 2,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z", resolutionSuggestedAt: null, resolutionSuggestedById: null };
const result = (data = [row], total = data.length, page = 1): api.StaffQueueResponse => ({ data,
  pagination: { total, totalItems: total, page, currentPage: page, pageSize: 10, limit: 10, totalPages: Math.max(1, Math.ceil(total / 10)) } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

describe("UI-07 Staff Queue", () => {
  beforeEach(() => {
    vi.restoreAllMocks(); auth.user.role = "IT_STAFF"; auth.user.mustChangePassword = false;
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Network" }]);
    vi.spyOn(api, "getStaffTickets").mockResolvedValue(result());
  });
  it("shows loading, required queue fields and desktop/tablet/mobile representations", async () => {
    const pending = deferred<api.StaffQueueResponse>(); vi.mocked(api.getStaffTickets).mockReturnValue(pending.promise);
    render(<StaffTicketQueue />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Ticket Queue");
    await waitFor(() => expect(api.getStaffTickets).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 10, sortBy: "createdAt", sortOrder: "desc" }), expect.any(AbortSignal)));
    await act(async () => pending.resolve(result()));
    expect(screen.getByRole("table")).toHaveClass("queue-table");
    expect(screen.getByRole("table").parentElement).toHaveClass("d-none", "d-lg-block");
    expect(screen.getByRole("article").parentElement).toHaveClass("d-lg-none");
    expect(screen.getAllByText("Requester A")).toHaveLength(2);
    expect(screen.getAllByText("Owner A (Administrator)")).toHaveLength(2);
    expect(within(screen.getByRole("table")).getByText("Waiting for requester")).toHaveClass("badge-status", "badge-status-waiting-for-requester");
    expect(within(screen.getByRole("article")).getByText("Waiting for requester")).toHaveClass("badge-status", "badge-status-waiting-for-requester");
    expect(screen.getByRole("cell", { name: /Requested: High.*IT: Critical/ })).toBeInTheDocument();
    expect(screen.getByText("1 matching tickets")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Filters and sorting" });
    expect(toggle).toHaveAttribute("aria-expanded", "false"); fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("queue-filters")).toHaveClass("is-open");
  });
  it("combines search, every filter and sorting, changes page size and clears filters", async () => {
    render(<StaffTicketQueue />); await screen.findAllByText(row.summary);
    for (const [label, value] of [["Search tickets", "  wifi  "], ["Status", "WAITING_FOR_REQUESTER"], ["Category", "1"],
      ["Requested Priority", "HIGH"], ["IT Priority", "CRITICAL"], ["Owner", "id"], ["Sort By", "itPriority"], ["Direction", "asc"], ["Page size", "20"]])
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.change(screen.getByLabelText("Owner ID"), { target: { value: "4" } });
    await waitFor(() => expect(api.getStaffTickets).toHaveBeenLastCalledWith({ search: "wifi", status: "WAITING_FOR_REQUESTER", categoryId: 1,
      priority: "HIGH", itPriority: "CRITICAL", ownerId: 4, sortBy: "itPriority", sortOrder: "asc", page: 1, pageSize: 20 }, expect.any(AbortSignal)));
    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "unassigned" } });
    await waitFor(() => expect(api.getStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ ownerId: "unassigned" }), expect.any(AbortSignal)));
    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    await waitFor(() => expect(api.getStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ search: "", ownerId: undefined,
      status: "", itPriority: "", categoryId: undefined, page: 1, pageSize: 10, sortBy: "createdAt", sortOrder: "desc" }), expect.any(AbortSignal)));
  });
  it("paginates with bounded controls and resets the page after filtering", async () => {
    vi.mocked(api.getStaffTickets).mockImplementation(async params => result([row], 21, params.page));
    render(<StaffTicketQueue />); await screen.findAllByText(row.summary);
    expect(screen.getByRole("button", { name: "Previous Page" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next Page" })); await screen.findByText("Page 2 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Next Page" })); await screen.findByText("Page 3 of 3");
    expect(screen.getByRole("button", { name: "Next Page" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "NEW" } }); await screen.findByText("Page 1 of 3");
  });
  it("keeps empty queue and no matching results distinct", async () => {
    vi.mocked(api.getStaffTickets).mockResolvedValue(result([])); render(<StaffTicketQueue />);
    await screen.findByText("The shared Ticket Queue is empty.");
    fireEvent.change(screen.getByLabelText("Search tickets"), { target: { value: "missing" } });
    await screen.findByText("No matching tickets. Try changing or clearing the filters.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it.each([403, 400, 500])("shows distinct safe error feedback for %s, clears old rows, and can retry", async status => {
    render(<StaffTicketQueue />); await screen.findAllByText(row.summary);
    vi.mocked(api.getStaffTickets).mockRejectedValueOnce(new api.QueueError(status));
    fireEvent.click(screen.getByRole("button", { name: "Refresh Queue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(new api.QueueError(status).message);
    expect(screen.queryByText(row.summary)).not.toBeInTheDocument();
    expect(screen.queryByText(/shared Ticket Queue is empty/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh Queue" })); await screen.findAllByText(row.summary);
  });
  it("validates Owner ID and search length without sending invalid requests", async () => {
    render(<StaffTicketQueue />); await screen.findAllByText(row.summary);
    const calls = vi.mocked(api.getStaffTickets).mock.calls.length;
    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "id" } });
    fireEvent.change(screen.getByLabelText("Owner ID"), { target: { value: "1x" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid Owner ID");
    expect(screen.queryByText(row.summary)).not.toBeInTheDocument();
    expect(api.getStaffTickets).toHaveBeenCalledTimes(calls);
    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Search tickets"), { target: { value: "x".repeat(201) } });
    expect(screen.getByRole("alert")).toHaveTextContent("200 characters or fewer");
  });
  it("ignores out-of-order responses and aborts work on unmount", async () => {
    const stale = deferred<api.StaffQueueResponse>(); vi.mocked(api.getStaffTickets).mockReturnValueOnce(stale.promise);
    const view = render(<StaffTicketQueue />); await waitFor(() => expect(api.getStaffTickets).toHaveBeenCalledTimes(1));
    const firstSignal = vi.mocked(api.getStaffTickets).mock.calls[0][1]!;
    fireEvent.change(screen.getByLabelText("Sort By"), { target: { value: "itPriority" } });
    await screen.findAllByText(row.summary); expect(firstSignal.aborted).toBe(true);
    await act(async () => stale.resolve(result([{ ...row, summary: "Obsolete result" }])));
    expect(screen.queryByText("Obsolete result")).not.toBeInTheDocument();
    const lastSignal = vi.mocked(api.getStaffTickets).mock.calls.at(-1)![1]!;
    view.unmount(); expect(lastSignal.aborted).toBe(true);
  });
  it("opens only a queue preview and preserves filters on Back or queue navigation", async () => {
    const view = render(<StaffTicketQueue />); await screen.findAllByText(row.summary);
    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "unassigned" } }); await screen.findAllByText(row.summary);
    fireEvent.click(screen.getAllByRole("button", { name: `Open Detail ${row.ticketNumber}` })[0]);
    expect(screen.getByRole("region", { name: "Ticket overview" })).toBeInTheDocument();
    expect(screen.getByText(row.description)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /claim|assign|priority|status|comment|note/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to Ticket Queue" }));
    expect(screen.getByLabelText("Owner")).toHaveValue("unassigned");
    fireEvent.click(screen.getAllByRole("button", { name: `Open Detail ${row.ticketNumber}` })[0]);
    view.rerender(<StaffTicketQueue navigationVersion={1} />);
    expect(screen.getByLabelText("Owner")).toHaveValue("unassigned");
  });
  it("shows category loading failure without fabricating options", async () => {
    vi.mocked(api.getCategories).mockRejectedValueOnce(new Error("Network failure")); render(<StaffTicketQueue />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Categories could not be loaded");
    expect(screen.getByLabelText("Category").children).toHaveLength(1);
  });
  it("provides Staff navigation, keeps Requester destinations, and denies Admin/restricted navigation", () => {
    const navigate = vi.fn(), view = render(<Header onNavigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Ticket Queue" })); expect(navigate).toHaveBeenCalledWith("staff-queue");
    expect(screen.getByRole("navigation", { name: "IT Staff" })).toBeInTheDocument();
    auth.user.role = "REQUESTER"; view.rerender(<Header />);
    expect(screen.getByRole("button", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Ticket" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ticket Queue" })).not.toBeInTheDocument();
    auth.user.role = "ADMINISTRATOR"; view.rerender(<Header />);
    expect(screen.queryByRole("navigation", { name: "IT Staff" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ticket Queue" })).not.toBeInTheDocument();
    auth.user.role = "IT_STAFF"; auth.user.mustChangePassword = true; view.rerender(<Header />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
  it("serializes queue queries through the session client without identity overrides", async () => {
    vi.mocked(api.getStaffTickets).mockRestore();
    const fetch = vi.spyOn(authClient, "sessionFetch").mockResolvedValue(new Response(JSON.stringify(result()), { status: 200 }));
    const controller = new AbortController();
    await api.getStaffTickets({ search: "wifi & vpn", ownerId: "unassigned", status: "ALL", page: 2, pageSize: 20, itPriority: "HIGH" }, controller.signal);
    expect(fetch).toHaveBeenCalledWith("/api/staff/tickets?search=wifi+%26+vpn&ownerId=unassigned&page=2&pageSize=20&itPriority=HIGH", { signal: controller.signal });
    fetch.mockResolvedValue(new Response("{}", { status: 403 }));
    await expect(api.getStaffTickets({})).rejects.toMatchObject({ status: 403 });
  });
  it("applies approved status badge classes for Waiting for requester, Reopened, and Cancelled", async () => {
    const statusesToTest: [api.TicketStatus, string, string][] = [
      ["WAITING_FOR_REQUESTER", "Waiting for requester", "badge-status-waiting-for-requester"],
      ["REOPENED", "Reopened", "badge-status-reopened"],
      ["CANCELLED", "Cancelled", "badge-status-cancelled"],
      ["NEW", "New", "badge-status-new"],
      ["OPEN", "Open", "badge-status-open"],
      ["IN_PROGRESS", "In progress", "badge-status-in-progress"],
      ["RESOLVED", "Resolved", "badge-status-resolved"],
      ["CLOSED", "Closed", "badge-status-closed"],
    ];
    const testRows = statusesToTest.map(([st, summary], idx) => ({
      ...row,
      id: idx + 1,
      ticketNumber: `TKT-2026-${100000 + idx + 1}`,
      summary: `Summary for ${summary}`,
      currentStatus: st,
    }));
    vi.mocked(api.getStaffTickets).mockResolvedValue(result(testRows, testRows.length));
    render(<StaffTicketQueue />);
    const table = await screen.findByRole("table");
    for (const [, labelText, expectedClass] of statusesToTest) {
      const badge = within(table).getByText(labelText);
      expect(badge).toHaveClass("badge-status", expectedClass);
    }
  });
});
