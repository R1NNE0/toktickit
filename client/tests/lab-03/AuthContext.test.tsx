import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as auth from "../../src/auth-client.js";
import * as api from "../../src/api.js";
vi.mock("../../src/auth-client.js", async importOriginal => {
  const actual = await importOriginal<typeof import("../../src/auth-client.js")>();
  return { ...actual, authRequest: vi.fn(), bootstrapCsrf: vi.fn().mockResolvedValue(undefined) };
});
const user: auth.CurrentUser = { id: 71, name: "Session User", email: "session@example.com", role: "IT_STAFF", isActive: true, mustChangePassword: true };
describe("UI-01/02 session screen integration (Issue 2 portion)", () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
  it("ignores stored identity and gates mandatory change until successful rotation", async () => {
    localStorage.setItem("toktickit_selected_requester_id", "999");
    const directory = vi.spyOn(api, "getActiveRequesters");
    vi.mocked(auth.authRequest).mockImplementation(async path => ({ user: { ...user, mustChangePassword: path !== "change-password" } }));
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Change password" })).toBeInTheDocument();
    expect(directory).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "My Tickets" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Current password"), "Initial password 123");
    await userEvent.type(screen.getByLabelText("New password"), "Changed password 456");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "Changed password 456");
    await userEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect(await screen.findByText("Signed in as IT Staff.")).toBeInTheDocument();
  });
  it("hides private content on unconfirmed logout and requires confirmation before returning to login", async () => {
    vi.mocked(auth.authRequest).mockImplementation(async path => {
      if (path === "logout") throw new Error("Network failure");
      return { user: { ...user, mustChangePassword: false } };
    });
    render(<App />);
    await screen.findByText("Signed in as IT Staff.");
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Logout could not be confirmed");
    expect(screen.queryByText("Signed in as IT Staff.")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
    vi.mocked(auth.authRequest).mockResolvedValue({ user });
    await userEvent.click(screen.getByRole("button", { name: "Retry sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Signed in as IT Staff.")).not.toBeInTheDocument();
  });
  it("supports a fresh login and clears a signed-in screen after server expiry", async () => {
    vi.mocked(auth.authRequest).mockImplementation(async path => {
      if (path === "me") throw new auth.AuthError("Sign in", 401, "UNAUTHENTICATED");
      return { user: { ...user, mustChangePassword: false } };
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Sign in" });
    await userEvent.type(screen.getByLabelText("Email"), user.email);
    await userEvent.type(screen.getByLabelText("Password"), "Initial password 123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText("Signed in as IT Staff.");
    act(() => window.dispatchEvent(new Event("toktickit:session-expired")));
    await screen.findByRole("heading", { name: "Sign in" });
    expect(screen.queryByText("Signed in as IT Staff.")).not.toBeInTheDocument();
  });
});
