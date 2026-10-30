import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "../../src/App.js";

const state = vi.hoisted(() => ({ role: "IT_STAFF", canLeave: true }));
vi.mock("../../src/action-ui.js", () => ({ canLeaveActions: () => state.canLeave }));
vi.mock("../../src/context/AuthContext.js", () => ({ AuthProvider: ({ children }: any) => children,
  useAuth: () => ({ user: { id: 1, role: state.role, name: "Operator", mustChangePassword: false }, logout: vi.fn() }) }));
vi.mock("../../src/components/StaffDashboard.js", () => ({ StaffDashboard: ({ onDrilldown, onOpenTicket, navigationVersion }: any) => <div>
  <h1>Operational metrics {navigationVersion}</h1><button onClick={() => onDrilldown({ view: "staff-queue", filters: { statusGroup: "active", ownerId: "me" } })}>My workload</button>
  <button onClick={() => onOpenTicket(20, 99)}>Selected action</button></div> }));
vi.mock("../../src/components/StaffTicketQueue.js", () => ({ StaffTicketQueue: ({ entry, onOpenDetail }: any) => <div>
  <p>Queue filters {JSON.stringify(entry)}</p><button onClick={() => onOpenDetail(30)}>Open queue Ticket</button></div> }));
vi.mock("../../src/components/StaffTicketDetail.js", () => ({ StaffTicketDetail: ({ ticketId, focusActionId, onBack }: any) => <div>
  <h1>Staff Ticket {ticketId} Action {focusActionId}</h1><button onClick={onBack}>Back</button></div> }));
vi.mock("../../src/components/TicketDetail.js", () => ({ TicketDetail: ({ ticketId, focusActionId, onBack }: any) => <div>
  <h1>Admin Ticket {ticketId} Action {focusActionId}</h1><button onClick={onBack}>Back</button></div> }));
vi.mock("../../src/components/UserManagement.js", () => ({ UserManagement: () => <h1>User administration</h1> }));
beforeEach(() => { state.role = "IT_STAFF"; state.canLeave = true; window.history.replaceState(null, "", "/"); });
afterEach(() => window.history.replaceState(null, "", "/"));
it.each(["IT_STAFF", "ADMINISTRATOR"])("lands %s on Dashboard and restores the queue descriptor after detail", role => {
  state.role = role; render(<App />);
  expect(screen.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("button", { name: "My workload" }));
  expect(screen.getByText('Queue filters {"statusGroup":"active","ownerId":"me"}')).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Open queue Ticket" }));
  expect(screen.getByRole("heading", { name: new RegExp(`${role === "IT_STAFF" ? "Staff" : "Admin"} Ticket 30`) })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByText('Queue filters {"statusGroup":"active","ownerId":"me"}')).toBeVisible();
});
it("passes selected Action identity, refreshes on return, and preserves the draft navigation guard", () => {
  render(<App />); fireEvent.click(screen.getByRole("button", { name: "Selected action" }));
  expect(screen.getByRole("heading", { name: "Staff Ticket 20 Action 99" })).toBeVisible();
  state.canLeave = false; fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
  expect(screen.getByRole("heading", { name: "Staff Ticket 20 Action 99" })).toBeVisible();
  state.canLeave = true; fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("heading", { name: "Operational metrics 1" })).toBeVisible();
});
it("preserves hash Ticket links and Administrator user management", () => {
  state.role = "ADMINISTRATOR"; window.history.replaceState(null, "", "/#/tickets/123"); render(<App />);
  expect(screen.getByRole("heading", { name: "Admin Ticket 123 Action" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "User Management" }));
  expect(screen.getByRole("heading", { name: "User administration" })).toBeVisible();
  act(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
});
it("returns from a hash Ticket URL to the originating dashboard on browser navigation", () => {
  render(<App />);
  act(() => { window.history.replaceState(null, "", "/#/tickets/123"); window.dispatchEvent(new HashChangeEvent("hashchange")); });
  expect(screen.getByRole("heading", { name: "Staff Ticket 123 Action" })).toBeVisible();
  act(() => { window.history.replaceState(null, "", "/"); window.dispatchEvent(new HashChangeEvent("hashchange")); });
  expect(screen.getByRole("heading", { name: "Operational metrics 1" })).toBeVisible();
});
