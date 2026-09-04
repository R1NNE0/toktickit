import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequesterProvider } from "../../context/RequesterContext.js";
import { MyTickets } from "../../components/MyTickets.js";
import * as api from "../../api.js";

const mockRequesters: api.RequesterUser[] = [
  {
    id: 1,
    name: "Jennifer Anderson",
    email: "jennifer.anderson@example.com",
    isActive: true,
  },
];

const mockCategories: api.Category[] = [
  { id: 1, name: "Hardware", isActive: true },
  { id: 2, name: "Software", isActive: true },
];

const mockTicketsResponse: api.PaginatedTicketsResponse = {
  data: [
    {
      id: 101,
      ticketNumber: "TKT-2026-000101",
      summary: "Laptop battery drains rapidly",
      description: "Battery discharges from 100% to 0% in under 30 minutes.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: "IN_PROGRESS",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 10,
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
      category: { id: 1, name: "Hardware" },
      attachments: [
        {
          id: 1,
          ticketId: 101,
          fileName: "battery-report.pdf",
          fileSize: 10240,
          mimeType: "application/pdf",
          isRemoved: false,
          createdAt: "2026-03-01T10:00:00.000Z",
        },
      ],
    },
    {
      id: 102,
      ticketNumber: "TKT-2026-000102",
      summary: "Cannot access internal wiki",
      description: "Getting HTTP 403 when navigating to wiki.",
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      currentStatus: "NEW",
      requesterId: 1,
      categoryId: 2,
      relatedSystemId: 20,
      createdAt: "2026-03-02T11:00:00.000Z",
      updatedAt: "2026-03-02T11:00:00.000Z",
      category: { id: 2, name: "Software" },
      attachments: [],
    },
  ],
  pagination: {
    page: 1,
    pageSize: 10,
    totalItems: 2,
    totalPages: 1,
  },
};

describe("Lab 2 (Issue #5) - MyTickets Component", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("toktickit_selected_requester_id", "1");
    vi.clearAllMocks();

    vi.spyOn(api, "getActiveRequesters").mockResolvedValue(mockRequesters);
    vi.spyOn(api, "getCategories").mockResolvedValue(mockCategories);
    vi.spyOn(api, "getTickets").mockResolvedValue(mockTicketsResponse);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders ticket table rows matching current requester (UI-03 / AC-04)", async () => {
    render(
      <RequesterProvider>
        <MyTickets />
      </RequesterProvider>
    );

    expect(
      await screen.findByRole("heading", { name: /My Support Tickets/i })
    ).toBeInTheDocument();

    // Verify tickets render across responsive views (table & cards)
    const tkt101Elements = await screen.findAllByText("TKT-2026-000101");
    expect(tkt101Elements.length).toBeGreaterThanOrEqual(1);

    expect(
      screen.getAllByText("Laptop battery drains rapidly")[0]
    ).toBeInTheDocument();
    expect(screen.getAllByText("IN PROGRESS")[0]).toBeInTheDocument();
    expect(screen.getAllByText("📎 1")[0]).toBeInTheDocument();

    expect(screen.getAllByText("TKT-2026-000102")[0]).toBeInTheDocument();
    expect(
      screen.getAllByText("Cannot access internal wiki")[0]
    ).toBeInTheDocument();
  });

  it("triggers API call with search text after typing (UI-04 / AC-05)", async () => {
    const getTicketsSpy = vi.spyOn(api, "getTickets");

    render(
      <RequesterProvider>
        <MyTickets />
      </RequesterProvider>
    );

    await screen.findAllByText("TKT-2026-000101");

    const searchInput = screen.getByLabelText(/Search tickets/i);
    await userEvent.type(searchInput, "battery");

    await waitFor(
      () => {
        expect(getTicketsSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            search: "battery",
          })
        );
      },
      { timeout: 1000 }
    );
  });

  it("triggers API call when changing status and category filters (UI-04 / AC-05)", async () => {
    const getTicketsSpy = vi.spyOn(api, "getTickets");

    render(
      <RequesterProvider>
        <MyTickets />
      </RequesterProvider>
    );

    await screen.findAllByText("TKT-2026-000101");

    const statusSelect = screen.getByLabelText(/Filter by status/i);
    await userEvent.selectOptions(statusSelect, "NEW");

    expect(getTicketsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "NEW",
      })
    );

    const categorySelect = screen.getByLabelText(/Filter by category/i);
    await userEvent.selectOptions(categorySelect, "2");

    expect(getTicketsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 2,
      })
    );
  });

  it("handles pagination navigation (AC-05)", async () => {
    const multiPageResponse: api.PaginatedTicketsResponse = {
      ...mockTicketsResponse,
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 15,
        totalPages: 2,
      },
    };
    const getTicketsSpy = vi
      .spyOn(api, "getTickets")
      .mockResolvedValue(multiPageResponse);

    render(
      <RequesterProvider>
        <MyTickets />
      </RequesterProvider>
    );

    await screen.findAllByText("TKT-2026-000101");

    const nextBtn = screen.getByRole("button", { name: /Next Page/i });
    expect(nextBtn).toBeEnabled();
    await userEvent.click(nextBtn);

    expect(getTicketsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
      })
    );
  });

  it("displays empty state when user has no tickets submitted", async () => {
    vi.spyOn(api, "getTickets").mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 1,
      },
    });

    const onNavigateCreate = vi.fn();

    render(
      <RequesterProvider>
        <MyTickets onNavigateCreate={onNavigateCreate} />
      </RequesterProvider>
    );

    expect(
      await screen.findByText(/No tickets submitted yet/i)
    ).toBeInTheDocument();

    const createFirstBtn = screen.getByRole("button", {
      name: /Create Your First Ticket/i,
    });
    await userEvent.click(createFirstBtn);
    expect(onNavigateCreate).toHaveBeenCalled();
  });

  it("displays no-matching-results state when search/filter returns zero tickets", async () => {
    vi.spyOn(api, "getTickets").mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 1,
      },
    });

    render(
      <RequesterProvider>
        <MyTickets />
      </RequesterProvider>
    );

    const searchInput = screen.getByLabelText(/Search tickets/i);
    await userEvent.type(searchInput, "nonexistent");

    expect(
      await screen.findByText(/No matching tickets found/i)
    ).toBeInTheDocument();

    const clearBtn = screen.getByRole("button", {
      name: /Clear All Filters/i,
    });
    await userEvent.click(clearBtn);

    expect(searchInput).toHaveValue("");
  });
});
