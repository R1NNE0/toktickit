import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { StaffTicketQueue } from "../../src/components/StaffTicketQueue.js";
import * as api from "../../src/api.js";

it("applies dashboard filters on page one, retains them on return, and resets for a new entry", async () => {
  vi.spyOn(api, "getCategories").mockResolvedValue([]);
  const fetch = vi.spyOn(api, "getStaffTickets").mockResolvedValue({ data: [], pagination: { total: 0, totalItems: 0, page: 1, currentPage: 1, pageSize: 10, limit: 10, totalPages: 1 } });
  const { rerender } = render(<StaffTicketQueue key={1} entry={{ statusGroup: "active", ownerId: "me" }} />);
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ statusGroup: "active", ownerId: "me", page: 1 }), expect.any(AbortSignal)));
  fireEvent.change(screen.getByLabelText("Search tickets"), { target: { value: "printer" } });
  rerender(<StaffTicketQueue key={1} navigationVersion={1} entry={{ statusGroup: "active", ownerId: "me" }} />);
  expect(screen.getByLabelText("Search tickets")).toHaveValue("printer");
  rerender(<StaffTicketQueue key={2} entry={{ status: "CLOSED" }} role="ADMINISTRATOR" />);
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ status: "CLOSED", ownerId: undefined, search: "", page: 1 }), expect.any(AbortSignal)));
  expect(screen.getByRole("heading", { name: "Administrator Ticket Queue" })).toBeInTheDocument();
});
