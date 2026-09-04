import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateTicket } from "../../src/components/CreateTicket.js";
import * as api from "../../src/api.js";

const mockCategories: api.Category[] = [
  { id: 1, name: "Hardware", isActive: true },
  { id: 2, name: "Software", isActive: true },
];

const mockRelatedSystems: api.RelatedSystem[] = [
  { id: 10, name: "Corporate Laptop", isActive: true },
  { id: 20, name: "LEB2 App", isActive: true },
];

describe("Lab 2 (Issue #4) - CreateTicket Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, "getCategories").mockResolvedValue(mockCategories);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue(mockRelatedSystems);
  });

  it("renders form fields with loaded categories and systems", async () => {
    render(<CreateTicket />);

    expect(
      await screen.findByRole("heading", { name: /Create Support Ticket/i })
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/Category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Affected System/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Requested Priority/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Summary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
  });

  it("blocks submission and shows inline red errors when summary and description are empty (UI-01 / AC-02)", async () => {
    const createSpy = vi.spyOn(api, "createTicket");
    render(<CreateTicket />);

    await screen.findByRole("heading", { name: /Create Support Ticket/i });

    const submitBtn = screen.getByRole("button", { name: /Create Ticket/i });
    await userEvent.click(submitBtn);

    expect(
      await screen.findByText(/Summary is required and cannot be blank/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Description is required and cannot be blank/i)
    ).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("shows busy loading state and disables submit button during ticket submission (UI-02 / BR-10)", async () => {
    let resolvePromise: (val: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.spyOn(api, "createTicket").mockReturnValue(pendingPromise as any);

    render(<CreateTicket />);
    await screen.findByRole("heading", { name: /Create Support Ticket/i });

    await userEvent.selectOptions(screen.getByLabelText(/Category/i), "1");
    await userEvent.selectOptions(
      screen.getByLabelText(/Affected System/i),
      "10"
    );
    await userEvent.type(
      screen.getByLabelText(/Summary/i),
      "Cannot connect to VPN"
    );
    await userEvent.type(
      screen.getByLabelText(/Description/i),
      "VPN client says TLS handshake failed"
    );

    const submitBtn = screen.getByRole("button", { name: /Create Ticket/i });
    await userEvent.click(submitBtn);

    expect(screen.getByText(/Submitting Ticket\.\.\./i)).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();

    // Finish submission
    resolvePromise!({
      id: 99,
      ticketNumber: "TKT-2026-000099",
      summary: "Cannot connect to VPN",
      description: "VPN client says TLS handshake failed",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: "NEW",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: { id: 1, name: "Hardware" },
      relatedSystem: { id: 10, name: "Corporate Laptop" },
    });

    expect(
      await screen.findByText(/Ticket Created Successfully!/i)
    ).toBeInTheDocument();
  });

  it("successfully creates a ticket and renders the confirmation card with TKT number (AC-01)", async () => {
    const mockCreatedTicket: api.Ticket = {
      id: 101,
      ticketNumber: "TKT-2026-000101",
      summary: "Printer toner low in Room 301",
      description: "Yellow toner cartridge needs replacement.",
      requestedPriority: "LOW",
      itPriority: "LOW",
      currentStatus: "NEW",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: { id: 1, name: "Hardware" },
      relatedSystem: { id: 10, name: "Corporate Laptop" },
    };

    vi.spyOn(api, "createTicket").mockResolvedValue(mockCreatedTicket);

    render(<CreateTicket />);
    await screen.findByRole("heading", { name: /Create Support Ticket/i });

    await userEvent.selectOptions(screen.getByLabelText(/Category/i), "1");
    await userEvent.selectOptions(
      screen.getByLabelText(/Affected System/i),
      "10"
    );
    await userEvent.type(
      screen.getByLabelText(/Summary/i),
      "Printer toner low in Room 301"
    );
    await userEvent.type(
      screen.getByLabelText(/Description/i),
      "Yellow toner cartridge needs replacement."
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Create Ticket/i })
    );

    expect(
      await screen.findByText(/Ticket Created Successfully!/i)
    ).toBeInTheDocument();
    expect(screen.getByText("TKT-2026-000101")).toBeInTheDocument();
    expect(screen.getByText(/Printer toner low in Room 301/i)).toBeInTheDocument();
  });

  it("displays error alert and preserves form values on network/server error (AC-10 / BR-11)", async () => {
    vi.spyOn(api, "createTicket").mockRejectedValue(
      new Error("Server is currently overloaded")
    );

    render(<CreateTicket />);
    await screen.findByRole("heading", { name: /Create Support Ticket/i });

    const summaryInput = screen.getByLabelText(/Summary/i);
    const descInput = screen.getByLabelText(/Description/i);

    await userEvent.selectOptions(screen.getByLabelText(/Category/i), "1");
    await userEvent.selectOptions(
      screen.getByLabelText(/Affected System/i),
      "10"
    );
    await userEvent.type(summaryInput, "Network outage in Lab 2");
    await userEvent.type(
      descInput,
      "All switch ports on rack B are unreachable"
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Create Ticket/i })
    );

    expect(
      await screen.findByText(/Server is currently overloaded/i)
    ).toBeInTheDocument();

    // Verify form input values are preserved!
    expect(summaryInput).toHaveValue("Network outage in Lab 2");
    expect(descInput).toHaveValue(
      "All switch ports on rack B are unreachable"
    );
  });
});
