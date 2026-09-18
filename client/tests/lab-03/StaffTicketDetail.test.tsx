import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaffTicketDetail } from "../../src/components/StaffTicketDetail.js";
import * as api from "../../src/api.js";

const authStaff = { id: 2, name: "Staff Member", email: "staff@example.com", role: "IT_STAFF", isActive: true, mustChangePassword: false };
vi.mock("../../src/context/AuthContext.js", () => ({ useAuth: () => ({ user: authStaff }) }));

const baseStaffTicket: api.StaffTicketDetail = {
  id: 101,
  ticketNumber: "TKT-2026-000101",
  summary: "VPN Connection Failure",
  description: "User cannot connect to corporate VPN after update.",
  requesterId: 1,
  requester: { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com" },
  categoryId: 2,
  category: { id: 2, name: "Network" },
  relatedSystemId: 3,
  relatedSystem: { id: 3, name: "VPN" },
  requestedPriority: "HIGH",
  itPriority: "HIGH",
  currentStatus: "OPEN",
  ownerId: null,
  owner: null,
  createdAt: "2026-09-18T08:00:00.000Z",
  updatedAt: "2026-09-18T08:30:00.000Z",
  attachments: [],
  attachmentCount: 0,
  resolutionSuggestedAt: null,
  resolutionSuggestedById: null,
};

const assignees: api.Assignee[] = [
  { id: 2, name: "Staff Member", role: "IT_STAFF", isActive: true },
  { id: 5, name: "Alex Admin", role: "ADMINISTRATOR", isActive: true },
];

describe("UI-08 Staff Ticket Detail: Read-Only Context, Claim, Assignment, Priority & Status Workflow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getStaffTicketDetail").mockResolvedValue(baseStaffTicket);
    vi.spyOn(api, "getStaffAssignees").mockResolvedValue(assignees);
    vi.spyOn(api, "getPublicComments").mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
    });
    vi.spyOn(api, "getInternalNotes").mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
    });
  });

  it("renders grouped read-only context and non-editable submitter fields", async () => {
    render(<StaffTicketDetail ticketId={101} onBack={() => {}} />);
    await screen.findByText(baseStaffTicket.ticketNumber);

    expect(screen.getByText("VPN Connection Failure")).toBeInTheDocument();
    expect(screen.getByText(/User cannot connect to corporate VPN/i)).toBeInTheDocument();
    expect(screen.getByText(/Jennifer Anderson \(jennifer@example.com\)/i)).toBeInTheDocument();
    expect(screen.getByText("Network")).toBeInTheDocument();
    expect(screen.getByText("VPN")).toBeInTheDocument();
    expect(screen.getByText("Requested Priority (by Requester)")).toBeInTheDocument();
  });

  it("allows Staff to claim unassigned ticket and handles 409 conflict", async () => {
    const claim = vi.spyOn(api, "claimTicket").mockResolvedValue({
      ...baseStaffTicket,
      ownerId: 2,
      owner: { id: 2, name: "Staff Member", role: "IT_STAFF", isActive: true },
    });

    render(<StaffTicketDetail ticketId={101} onBack={() => {}} />);
    const claimBtn = await screen.findByRole("button", { name: "Claim Ticket" });
    await userEvent.click(claimBtn);

    expect(claim).toHaveBeenCalledWith(101);
    expect(await screen.findByText(/You have successfully claimed this ticket/i)).toBeInTheDocument();

    // Now test 409 conflict
    claim.mockRejectedValueOnce(new api.ApiError(409, "ALREADY_ASSIGNED", "Ticket is already assigned."));
    vi.mocked(api.getStaffTicketDetail).mockResolvedValue({ ...baseStaffTicket, ownerId: null });

    render(<StaffTicketDetail ticketId={101} onBack={() => {}} />);
    const claimBtn2 = await screen.findByRole("button", { name: "Claim Ticket" });
    await userEvent.click(claimBtn2);

    expect(await screen.findByText(/This ticket has already been assigned or claimed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh Ticket" })).toBeInTheDocument();
  });

  it("allows Staff to reassign owner to another eligible staff or unassign", async () => {
    const updateOwner = vi.spyOn(api, "updateTicketOwner").mockResolvedValue({
      ...baseStaffTicket,
      ownerId: 5,
      owner: { id: 5, name: "Alex Admin", role: "ADMINISTRATOR", isActive: true },
    });

    render(<StaffTicketDetail ticketId={101} onBack={() => {}} />);
    await screen.findByText(baseStaffTicket.ticketNumber);

    const ownerSelect = screen.getByLabelText("Assign Owner");
    await userEvent.selectOptions(ownerSelect, "5");
    await userEvent.click(screen.getByRole("button", { name: "Save Owner" }));

    expect(updateOwner).toHaveBeenCalledWith(101, 5);
    expect(await screen.findByText(/Ticket owner updated successfully/i)).toBeInTheDocument();

    // Unassign
    updateOwner.mockResolvedValueOnce({
      ...baseStaffTicket,
      ownerId: null,
      owner: null,
    });
    await userEvent.selectOptions(ownerSelect, "");
    await userEvent.click(screen.getByRole("button", { name: "Save Owner" }));
    expect(updateOwner).toHaveBeenCalledWith(101, null);
  });

  it("allows Staff to update IT Priority without modifying requested priority", async () => {
    const updatePriority = vi.spyOn(api, "updateTicketPriority").mockResolvedValue({
      ...baseStaffTicket,
      itPriority: "CRITICAL",
    });

    render(<StaffTicketDetail ticketId={101} onBack={() => {}} />);
    await screen.findByText(baseStaffTicket.ticketNumber);

    const prioritySelect = screen.getByLabelText("IT Priority");
    await userEvent.selectOptions(prioritySelect, "CRITICAL");
    await userEvent.click(screen.getByRole("button", { name: "Save Priority" }));

    expect(updatePriority).toHaveBeenCalledWith(101, "CRITICAL");
    expect(await screen.findByText(/IT Priority updated to CRITICAL/i)).toBeInTheDocument();
  });

  it("enforces status transition owner requirement and confirmation modal with reason", async () => {
    // Ticket in OPEN status but unassigned (ownerId: null)
    render(<StaffTicketDetail ticketId={101} onBack={() => {}} />);
    await screen.findByText(baseStaffTicket.ticketNumber);

    const statusSelect = screen.getByLabelText("Next Status");
    // OPEN -> IN_PROGRESS requires owner
    await userEvent.selectOptions(statusSelect, "IN_PROGRESS");
    await userEvent.click(screen.getByRole("button", { name: "Update Status" }));

    // Should show validation error that owner is required
    expect(screen.getByText(/requires an active eligible assigned owner/i)).toBeInTheDocument();

    // Now test transition to CANCELLED (requires confirmation and reason)
    const updateStatus = vi.spyOn(api, "updateTicketStatus").mockResolvedValue({
      ...baseStaffTicket,
      currentStatus: "CANCELLED",
    });

    await userEvent.selectOptions(statusSelect, "CANCELLED");
    await userEvent.click(screen.getByRole("button", { name: "Update Status" }));

    // Modal appears
    expect(screen.getByText(/Confirm Status Change: Open → Cancel/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Reason for Cancel *")).toBeInTheDocument();

    // Enter reason and confirm
    const reasonInput = screen.getByLabelText("Reason for Cancel *");
    await userEvent.type(reasonInput, "Duplicate issue reported by requester.");
    await userEvent.click(screen.getByRole("button", { name: "Confirm Status Change" }));

    expect(updateStatus).toHaveBeenCalledWith(101, {
      currentStatus: "CANCELLED",
      confirmed: true,
      reason: "Duplicate issue reported by requester.",
    });
  });

  it("displays Requester resolution indication banner when present", async () => {
    vi.mocked(api.getStaffTicketDetail).mockResolvedValue({
      ...baseStaffTicket,
      resolutionSuggestedAt: "2026-09-18T10:00:00.000Z",
      resolutionSuggestedById: 1,
    });

    render(<StaffTicketDetail ticketId={101} onBack={() => {}} />);
    await screen.findByText(baseStaffTicket.ticketNumber);

    expect(screen.getByText(/Requester Resolution Notice:/i)).toBeInTheDocument();
    expect(screen.getByText(/requester indicated that this problem appears resolved/i)).toBeInTheDocument();
  });
});

describe("UI-09 Staff Ticket Detail: Separate Public Comments & Internal Notes Threads", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getStaffTicketDetail").mockResolvedValue(baseStaffTicket);
    vi.spyOn(api, "getStaffAssignees").mockResolvedValue(assignees);
  });

  it("renders distinct Public Comments and Internal Notes sections with separate composers", async () => {
    vi.spyOn(api, "getPublicComments").mockResolvedValue({
      data: [{ id: 1, ticketId: 101, body: "Public update for requester", author: { id: 2, name: "Staff Member" }, createdAt: "2026-09-18T09:00:00Z" }],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    vi.spyOn(api, "getInternalNotes").mockResolvedValue({
      data: [{ id: 10, ticketId: 101, body: "Confidential triage diagnostics", author: { id: 2, name: "Staff Member" }, createdAt: "2026-09-18T09:05:00Z" }],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });

    render(<StaffTicketDetail ticketId={101} onBack={() => {}} />);
    await screen.findByText("Public update for requester");
    expect(screen.getByText("Confidential triage diagnostics")).toBeInTheDocument();

    // Verify section labels
    expect(screen.getByText("Public — visible to the Requester")).toBeInTheDocument();
    expect(screen.getByText("Internal — IT Staff and Administrator only")).toBeInTheDocument();

    // Verify distinct composers
    expect(screen.getByLabelText("Public comment")).toBeInTheDocument();
    expect(screen.getByLabelText("Internal note")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post Comment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post Internal Note" })).toBeInTheDocument();

    // No edit or delete buttons on comments/notes
    expect(screen.queryByRole("button", { name: /Edit Comment|Delete Comment|Edit Note|Delete Note/i })).not.toBeInTheDocument();
  });

  it("posts public comment and internal note independently without mixing destinations", async () => {
    vi.spyOn(api, "getPublicComments").mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
    });
    vi.spyOn(api, "getInternalNotes").mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
    });

    const postComment = vi.spyOn(api, "createPublicComment").mockResolvedValue({
      id: 2,
      ticketId: 101,
      body: "We are actively investigating the VPN server.",
      author: { id: 2, name: "Staff Member" },
      createdAt: "2026-09-18T09:10:00Z",
    });

    const postNote = vi.spyOn(api, "createInternalNote").mockResolvedValue({
      id: 11,
      ticketId: 101,
      body: "Check RADIUS log line 452 for timeout.",
      author: { id: 2, name: "Staff Member" },
      createdAt: "2026-09-18T09:12:00Z",
    });

    render(<StaffTicketDetail ticketId={101} onBack={() => {}} />);
    await screen.findByText(baseStaffTicket.ticketNumber);

    // Post to Public Comment
    const commentInput = screen.getByLabelText("Public comment");
    await userEvent.type(commentInput, "We are actively investigating the VPN server.");
    await userEvent.click(screen.getByRole("button", { name: "Post Comment" }));

    expect(postComment).toHaveBeenCalledWith(101, "We are actively investigating the VPN server.");
    expect(postNote).not.toHaveBeenCalled();

    // Post to Internal Note
    const noteInput = screen.getByLabelText("Internal note");
    await userEvent.type(noteInput, "Check RADIUS log line 452 for timeout.");
    await userEvent.click(screen.getByRole("button", { name: "Post Internal Note" }));

    expect(postNote).toHaveBeenCalledWith(101, "Check RADIUS log line 452 for timeout.");
  });
});
