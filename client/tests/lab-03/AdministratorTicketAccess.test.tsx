import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TicketDetail } from "../../src/components/TicketDetail.js";
import * as api from "../../src/api.js";

const adminUser = {
  id: 5,
  name: "Alex Admin",
  email: "admin@example.com",
  role: "ADMINISTRATOR",
  isActive: true,
  mustChangePassword: false,
};

vi.mock("../../src/context/AuthContext.js", () => ({
  useAuth: () => ({ user: adminUser }),
}));

const ticket: api.Ticket = {
  id: 101,
  ticketNumber: "TKT-2026-000101",
  summary: "Known Ticket for Admin Inspection",
  description: "Detailed system error reported by user.",
  requesterId: 1,
  requester: { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com" },
  categoryId: 1,
  category: { id: 1, name: "Hardware" },
  relatedSystemId: 2,
  relatedSystem: { id: 2, name: "Laptop" },
  requestedPriority: "LOW",
  itPriority: "LOW",
  currentStatus: "IN_PROGRESS",
  createdAt: "2026-09-18T08:00:00.000Z",
  updatedAt: "2026-09-18T08:30:00.000Z",
  attachments: [
    {
      id: 1,
      ticketId: 101,
      fileName: "diagnostics.log",
      fileSize: 2048,
      mimeType: "text/plain",
      isRemoved: false,
      removedAt: null,
      removalReason: null,
      createdAt: "2026-09-18T08:05:00.000Z",
    },
  ],
  attachmentCount: 1,
};

describe("UI-12 Administrator Ticket Detail Capability View", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getTicketDetail").mockResolvedValue(ticket);
    vi.spyOn(api, "getPublicComments").mockResolvedValue({
      data: [
        {
          id: 1,
          ticketId: 101,
          body: "Public update for requester",
          author: { id: 2, name: "Staff Member" },
          createdAt: "2026-09-18T08:10:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    vi.spyOn(api, "getInternalNotes").mockResolvedValue({
      data: [
        {
          id: 10,
          ticketId: 101,
          body: "Confidential hardware replacement note",
          author: { id: 2, name: "Staff Member" },
          createdAt: "2026-09-18T08:15:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
  });

  it("renders read-only ticket info, attachment metadata, and read-only comments/notes without composers", async () => {
    render(<TicketDetail ticketId={101} onBack={() => {}} />);
    await screen.findByText(ticket.ticketNumber);

    // Read-only ticket context
    expect(screen.getByText("Known Ticket for Admin Inspection")).toBeInTheDocument();
    expect(screen.getByText("Detailed system error reported by user.")).toBeInTheDocument();
    expect(screen.getByText(/Jennifer Anderson \(jennifer@example.com\)/)).toBeInTheDocument();

    // Attachment metadata is shown, but upload/download/remove are NOT present
    expect(screen.getByText("diagnostics.log")).toBeInTheDocument();
    expect(screen.queryByLabelText("Add Attachment")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/i })).not.toBeInTheDocument();

    // Public Comments are rendered read-only (no composer or post button)
    expect(screen.getByText("Public update for requester")).toBeInTheDocument();
    expect(screen.queryByLabelText("Public comment")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Post Comment" })).not.toBeInTheDocument();

    // Internal Notes are rendered read-only (no composer or post button)
    expect(screen.getByText("Confidential hardware replacement note")).toBeInTheDocument();
    expect(screen.queryByLabelText("Internal note")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Post Internal Note" })).not.toBeInTheDocument();

    // Operational staff controls are completely absent for Administrator
    expect(screen.queryByRole("button", { name: /Claim/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Assign Owner/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Next Status/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Problem Appears Resolved/i })).not.toBeInTheDocument();
  });

  it("permits Administrator to update IT Priority while keeping requested priority unchanged", async () => {
    const updatePriority = vi.spyOn(api, "updateTicketPriority").mockResolvedValue({
      ...ticket,
      itPriority: "CRITICAL",
    });

    render(<TicketDetail ticketId={101} onBack={() => {}} />);
    await screen.findByText(ticket.ticketNumber);

    // Requested Priority is read-only
    expect(screen.getByText("Requested Priority")).toBeInTheDocument();
    expect(screen.queryByLabelText("Requested Priority")).not.toBeInTheDocument();

    // IT Priority is editable via select
    const select = screen.getByLabelText("IT Priority");
    expect(select).toBeInTheDocument();
    await userEvent.selectOptions(select, "CRITICAL");
    await userEvent.click(screen.getByRole("button", { name: "Save Priority" }));

    expect(updatePriority).toHaveBeenCalledWith(101, "CRITICAL");
    expect(await screen.findByText(/IT Priority updated to CRITICAL/i)).toBeInTheDocument();
  });

  it("renders safe error feedback on ticket not found or failure", async () => {
    vi.mocked(api.getTicketDetail).mockRejectedValueOnce(new Error("Ticket not found"));
    render(<TicketDetail ticketId={999} onBack={() => {}} />);

    expect(await screen.findByText(/Ticket not found/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
