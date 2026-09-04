import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TicketDetail } from "../../components/TicketDetail.js";
import * as api from "../../api.js";

const mockTicketDetail: api.Ticket = {
  id: 101,
  ticketNumber: "TKT-2026-000101",
  summary: "Laptop battery drains rapidly after Windows update",
  description:
    "My laptop battery discharges from 100% to 0% in under 30 minutes while running standard office applications.",
  requestedPriority: "MEDIUM",
  itPriority: "MEDIUM",
  currentStatus: "IN_PROGRESS",
  requesterId: 1,
  categoryId: 1,
  relatedSystemId: 10,
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:30:00.000Z",
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 10, name: "Corporate Laptop" },
  requester: {
    id: 1,
    name: "Jennifer Anderson",
    email: "jennifer.anderson@example.com",
  },
  attachments: [
    {
      id: 5,
      ticketId: 101,
      fileName: "battery_report.pdf",
      fileSize: 1048576,
      mimeType: "application/pdf",
      isRemoved: false,
      removedAt: null,
      removalReason: null,
      createdAt: "2026-03-01T10:05:00.000Z",
    },
    {
      id: 6,
      ticketId: 101,
      fileName: "wrong_screenshot.png",
      fileSize: 524288,
      mimeType: "image/png",
      isRemoved: true,
      removedAt: "2026-03-01T10:15:00.000Z",
      removalReason: "Uploaded accidentally, contained private information",
      createdAt: "2026-03-01T10:06:00.000Z",
    },
  ],
};

describe("Lab 2 (Issue #6) - TicketDetail Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, "getTicketDetail").mockResolvedValue(mockTicketDetail);
    vi.spyOn(api, "downloadAttachment").mockResolvedValue(undefined);
    vi.spyOn(api, "softRemoveAttachment").mockResolvedValue({
      id: 5,
      ticketId: 101,
      fileName: "battery_report.pdf",
      fileSize: 1048576,
      mimeType: "application/pdf",
      isRemoved: true,
      removedAt: "2026-03-01T11:00:00.000Z",
      removalReason: "Report was superseded by new battery hardware logs",
      createdAt: "2026-03-01T10:05:00.000Z",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders read-only ticket details, metadata, summary, and description (UI-05 / AC-06)", async () => {
    const onBack = vi.fn();
    render(<TicketDetail ticketId={101} onBack={onBack} />);

    // Check loading indicator first, then loaded content
    expect(await screen.findByText("TKT-2026-000101")).toBeInTheDocument();
    expect(
      screen.getByText("Laptop battery drains rapidly after Windows update")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/My laptop battery discharges from 100% to 0%/i)
    ).toBeInTheDocument();

    // Metadata checks
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("Corporate Laptop")).toBeInTheDocument();
    expect(screen.getByText(/Jennifer Anderson/i)).toBeInTheDocument();
    expect(screen.getAllByText(/IN PROGRESS/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/MEDIUM Priority/i)).toBeInTheDocument();
  });

  it("renders both active and soft-removed attachments with respective badges and reasons (UI-05 / AC-08)", async () => {
    const onBack = vi.fn();
    render(<TicketDetail ticketId={101} onBack={onBack} />);

    await screen.findByText("TKT-2026-000101");

    // Active attachment
    expect(screen.getByText("battery_report.pdf")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Download battery_report\.pdf/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Remove battery_report\.pdf/i })
    ).toBeInTheDocument();

    // Soft-removed attachment
    expect(screen.getByText("wrong_screenshot.png")).toBeInTheDocument();
    expect(screen.getByText(/Soft Removed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Uploaded accidentally, contained private information/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/File download permanently blocked per data retention policy/i)
    ).toBeInTheDocument();
  });

  it("triggers file download on active attachment click (FR-09 / AC-08)", async () => {
    const downloadSpy = vi.spyOn(api, "downloadAttachment");
    const onBack = vi.fn();
    render(<TicketDetail ticketId={101} onBack={onBack} />);

    await screen.findByText("TKT-2026-000101");

    const downloadBtn = screen.getByRole("button", {
      name: /Download battery_report\.pdf/i,
    });
    await userEvent.click(downloadBtn);

    expect(downloadSpy).toHaveBeenCalledWith(5, "battery_report.pdf");
  });

  it("opens soft removal modal and validates non-empty reason before confirming (UI-06 / FR-10 / AC-08)", async () => {
    const removeSpy = vi.spyOn(api, "softRemoveAttachment");
    const onBack = vi.fn();
    render(<TicketDetail ticketId={101} onBack={onBack} />);

    await screen.findByText("TKT-2026-000101");

    const removeBtn = screen.getByRole("button", {
      name: /Remove battery_report\.pdf/i,
    });
    await userEvent.click(removeBtn);

    // Modal opens
    expect(
      screen.getByRole("heading", { name: /Confirm Attachment Soft Removal/i })
    ).toBeInTheDocument();

    // Try confirming with empty reason
    const confirmBtn = screen.getByRole("button", {
      name: /Confirm Soft Removal/i,
    });
    await userEvent.click(confirmBtn);

    expect(
      await screen.findByText(/A removal reason is mandatory and cannot be blank/i)
    ).toBeInTheDocument();
    expect(removeSpy).not.toHaveBeenCalled();

    // Enter valid reason
    const reasonInput = screen.getByLabelText(/Reason for Removal/i);
    await userEvent.type(
      reasonInput,
      "Report was superseded by new battery hardware logs"
    );

    // Confirm removal
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(removeSpy).toHaveBeenCalledWith(
        5,
        "Report was superseded by new battery hardware logs"
      );
    });

    // Modal closes and item updates to removed state in-place
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          name: /Confirm Attachment Soft Removal/i,
        })
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByText(/Report was superseded by new battery hardware logs/i)
    ).toBeInTheDocument();
  });

  it("navigates back to My Tickets when clicking Back button", async () => {
    const onBack = vi.fn();
    render(<TicketDetail ticketId={101} onBack={onBack} />);

    await screen.findByText("TKT-2026-000101");

    const backBtn = screen.getByRole("button", {
      name: /Back to My Tickets/i,
    });
    await userEvent.click(backBtn);

    expect(onBack).toHaveBeenCalled();
  });
});
