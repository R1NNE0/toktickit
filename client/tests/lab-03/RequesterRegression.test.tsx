import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateTicket } from "../../src/components/CreateTicket.js";
import { MyTickets } from "../../src/components/MyTickets.js";
import { TicketDetail } from "../../src/components/TicketDetail.js";
import * as api from "../../src/api.js";

const user = { id: 1, name: "Session Requester", email: "requester@example.com", role: "REQUESTER", isActive: true, mustChangePassword: false };
vi.mock("../../src/context/AuthContext.js", () => ({ useAuth: () => ({ user }) }));
const ticket: api.Ticket = { id: 101, ticketNumber: "TKT-2026-000101", summary: "Owned ticket", description: "Details", requesterId: 1,
  requestedPriority: "HIGH", itPriority: "HIGH", currentStatus: "NEW", categoryId: 1, relatedSystemId: 10,
  createdAt: "2026-09-16T00:00:00Z", updatedAt: "2026-09-16T00:00:00Z", attachments: [], attachmentCount: 0 };
const file = new File(["%PDF-1.4 synthetic"], "report.pdf", { type: "application/pdf" });
const attachment: api.Attachment = { id: 1, ticketId: 101, fileName: file.name, fileSize: file.size, mimeType: file.type,
  isRemoved: false, removedAt: null, removalReason: null, createdAt: ticket.createdAt };
const page = (rows: api.Ticket[]) => ({ data: rows, pagination: { page: 1, pageSize: 10, totalItems: rows.length, totalPages: 1 } });
async function fillCreate() {
  await screen.findByRole("combobox", { name: /Category/i });
  await userEvent.selectOptions(screen.getByLabelText(/Category/i), "1");
  await userEvent.selectOptions(screen.getByLabelText(/Affected System/i), "10");
  fireEvent.change(screen.getByLabelText(/Summary/i), { target: { value: "Owned ticket" } });
  fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: "Details" } });
}
describe("UI-04/05/06 Requester continuity (communication deferred to P5)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 10, name: "Email" }]);
    vi.spyOn(api, "getTicketDetail").mockResolvedValue(ticket);
    vi.spyOn(api, "getTickets").mockResolvedValue(page([ticket]));
  });
  it("shows session identity and read-only server values; retries failed files against the existing ticket", async () => {
    const create = vi.spyOn(api, "createTicket").mockResolvedValue(ticket);
    const upload = vi.spyOn(api, "uploadAttachment").mockRejectedValueOnce(new Error("Disconnected")).mockResolvedValue(attachment);
    render(<CreateTicket />); await fillCreate();
    expect(screen.getByText(/Session Requester/)).toBeInTheDocument();
    expect(screen.getByText(/assigned by the server/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/Requested Priority/i), "HIGH");
    expect(screen.getByText("IT Priority (read-only): HIGH")).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText("File Attachments"), file);
    await userEvent.click(screen.getByRole("button", { name: /^Create Ticket$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(file.name);
    expect(screen.getByRole("heading", { name: /some files were not uploaded/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry Failed Uploads" }));
    await screen.findByText("Ticket Created Successfully!");
    expect(create).toHaveBeenCalledTimes(1); expect(create.mock.calls[0][0]).not.toHaveProperty("requesterId");
    expect(upload).toHaveBeenCalledTimes(2); expect(upload.mock.calls.every(args => args[0] === ticket.id)).toBe(true);
    expect(api.getTicketDetail).toHaveBeenCalledWith(ticket.id);
  });
  it("refreshes metadata and does not duplicate an ambiguously completed upload", async () => {
    vi.spyOn(api, "createTicket").mockResolvedValue(ticket);
    const upload = vi.spyOn(api, "uploadAttachment").mockRejectedValue(new Error("Response lost"));
    vi.mocked(api.getTicketDetail).mockResolvedValue({ ...ticket, attachments: [attachment] });
    render(<CreateTicket />); await fillCreate();
    await userEvent.upload(screen.getByLabelText("File Attachments"), file);
    await userEvent.click(screen.getByRole("button", { name: /^Create Ticket$/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Retry Failed Uploads" }));
    expect(await screen.findByText(/matching attachment already exists/i)).toBeInTheDocument();
    expect(upload).toHaveBeenCalledTimes(1);
  });
  it("stops pending create uploads when the private screen unmounts", async () => {
    let complete!: (value: api.Ticket) => void;
    vi.spyOn(api, "createTicket").mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const upload = vi.spyOn(api, "uploadAttachment");
    const view = render(<CreateTicket />); await fillCreate();
    await userEvent.upload(screen.getByLabelText("File Attachments"), file);
    await userEvent.click(screen.getByRole("button", { name: /^Create Ticket$/i }));
    view.unmount(); await act(async () => { complete(ticket); });
    expect(upload).not.toHaveBeenCalled();
  });
  it("uses canonical attachment counts and visible sorts; obsolete queries cannot replace current rows", async () => {
    let complete!: (value: api.PaginatedTicketsResponse) => void;
    vi.mocked(api.getTickets).mockReturnValueOnce(new Promise(resolve => { complete = resolve; }))
      .mockResolvedValue(page([{ ...ticket, summary: "Current result", attachmentCount: 3 }]));
    render(<MyTickets />);
    await userEvent.selectOptions(screen.getByLabelText("Sort By"), "updatedAt");
    await screen.findAllByText("Current result");
    await act(async () => { complete(page([{ ...ticket, summary: "Obsolete result" }])); });
    expect(screen.queryByText("Obsolete result")).not.toBeInTheDocument();
    expect(screen.getAllByText(/📎 3/).length).toBeGreaterThan(0);
    await userEvent.selectOptions(screen.getByLabelText("Direction"), "asc");
    await waitFor(() => expect(api.getTickets).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "updatedAt", sortOrder: "asc", page: 1, pageSize: 10 })));
  });
  it("uploads from detail, refreshes metadata and retains read-only Requester controls", async () => {
    const upload = vi.spyOn(api, "uploadAttachment").mockResolvedValue(attachment);
    render(<TicketDetail ticketId={101} onBack={() => {}} />);
    await screen.findByText(ticket.ticketNumber);
    expect(screen.getByText("Requested Priority")).toBeInTheDocument();
    expect(screen.getByText("IT Priority")).toBeInTheDocument();
    vi.mocked(api.getTicketDetail).mockResolvedValue({ ...ticket, attachments: [attachment] });
    await userEvent.upload(screen.getByLabelText("Add Attachment"), file);
    expect(await screen.findByText(file.name)).toBeInTheDocument();
    expect(upload).toHaveBeenCalledWith(101, file, expect.any(AbortSignal));
    expect(screen.queryByText(/Internal Notes|Claim Ticket/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Problem Appears Resolved" })).toBeInTheDocument();
  });

  it("UI-06: handles Problem Appears Resolved indication and clears on reopening", async () => {
    const indicate = vi.spyOn(api, "indicateResolution").mockResolvedValue({
      ticketId: 101,
      currentStatus: "NEW",
      resolutionSuggestedAt: "2026-09-18T12:00:00.000Z",
      resolutionSuggestedById: 1,
    });

    const { unmount } = render(<TicketDetail ticketId={101} onBack={() => {}} />);
    await screen.findByText(ticket.ticketNumber);

    // Click Problem Appears Resolved
    const btn = screen.getByRole("button", { name: "Problem Appears Resolved" });
    await userEvent.click(btn);

    // Modal opens explaining effect
    expect(screen.getByText(/This informs IT Staff; it does not close your ticket/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Confirm$/i }));

    expect(indicate).toHaveBeenCalledWith(101);
    expect(await screen.findByText(/You indicated this problem appears resolved/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolution Indicated" })).toBeDisabled();

    // Now simulate Staff reopening the ticket (clearing resolutionSuggestedAt)
    vi.mocked(api.getTicketDetail).mockResolvedValue({
      ...ticket,
      currentStatus: "REOPENED",
      resolutionSuggestedAt: null,
      resolutionSuggestedById: null,
    } as any);

    // Unmount and remount to reload ticket state
    unmount();
    render(<TicketDetail ticketId={101} onBack={() => {}} />);
    await waitFor(() => expect(screen.queryByText(/You indicated this problem appears resolved/i)).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Problem Appears Resolved" })).toBeEnabled();
  });

  it("UI-06: displays public comments and allows Requester to post comments without exposing internal notes", async () => {
    vi.spyOn(api, "getPublicComments").mockResolvedValue({
      data: [{ id: 1, ticketId: 101, body: "Staff update message", author: { id: 2, name: "Staff Member" }, createdAt: "2026-09-18T10:00:00.000Z" }],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    const post = vi.spyOn(api, "createPublicComment").mockResolvedValue({
      id: 2, ticketId: 101, body: "Requester response", author: { id: 1, name: "Session Requester" }, createdAt: "2026-09-18T10:05:00.000Z",
    });

    render(<TicketDetail ticketId={101} onBack={() => {}} />);
    await screen.findByText("Staff update message");
    expect(screen.getByText("Staff Member")).toBeInTheDocument();

    // Verify Internal Notes is completely absent
    expect(screen.queryByText(/Internal Notes/i)).not.toBeInTheDocument();

    // Post comment
    const input = screen.getByLabelText("Public comment");
    await userEvent.type(input, "Requester response");
    await userEvent.click(screen.getByRole("button", { name: "Post Comment" }));

    expect(post).toHaveBeenCalledWith(101, "Requester response");
    expect(await screen.findByText("Requester response")).toBeInTheDocument();
  });
});
