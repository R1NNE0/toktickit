import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserManagement } from "../../src/components/UserManagement.js";
import * as api from "../../src/api.js";

const adminUser = {
  id: 1,
  name: "Alex Admin",
  email: "alex@example.com",
  role: "ADMINISTRATOR" as const,
  isActive: true,
  mustChangePassword: false,
};

vi.mock("../../src/context/AuthContext.js", () => ({
  useAuth: () => ({ user: adminUser, reload: vi.fn() }),
}));

const mockUsers: api.AdminUser[] = [
  {
    id: 1,
    name: "Alex Admin",
    email: "alex@example.com",
    role: "ADMINISTRATOR",
    isActive: true,
    mustChangePassword: false,
    createdAt: "2026-09-15T08:00:00.000Z",
    updatedAt: "2026-09-15T08:00:00.000Z",
  },
  {
    id: 2,
    name: "Jennifer Anderson",
    email: "jennifer@example.com",
    role: "REQUESTER",
    isActive: true,
    mustChangePassword: false,
    createdAt: "2026-09-15T08:00:00.000Z",
    updatedAt: "2026-09-15T08:00:00.000Z",
  },
  {
    id: 3,
    name: "Michael Scott",
    email: "michael@example.com",
    role: "IT_STAFF",
    isActive: true,
    mustChangePassword: false,
    createdAt: "2026-09-15T08:00:00.000Z",
    updatedAt: "2026-09-15T08:00:00.000Z",
  },
];

describe("UI-10 Administrator User Management Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getAdminUsers").mockResolvedValue({ data: mockUsers });
  });

  it("renders user directory with Name, Email, Role, Status, and Edit action", async () => {
    render(<UserManagement />);
    await screen.findByText("Alex Admin");

    // Table headings
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Email" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Role" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();

    // User rows inside table
    const table = screen.getByRole("table", { name: "Users Directory" });
    expect(within(table).getByText("Alex Admin")).toBeInTheDocument();
    expect(within(table).getByText("alex@example.com")).toBeInTheDocument();
    expect(within(table).getByText("Administrator")).toBeInTheDocument();
    expect(within(table).getByText("You")).toBeInTheDocument();

    expect(within(table).getByText("Jennifer Anderson")).toBeInTheDocument();
    expect(within(table).getByText("jennifer@example.com")).toBeInTheDocument();
    expect(within(table).getByText("Requester")).toBeInTheDocument();

    expect(within(table).getByText("Michael Scott")).toBeInTheDocument();
    expect(within(table).getByText("michael@example.com")).toBeInTheDocument();
    expect(within(table).getByText("IT Staff")).toBeInTheDocument();

    // Verify Edit buttons
    expect(screen.getByRole("button", { name: "Edit user Alex Admin" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit user Michael Scott" })).toBeInTheDocument();

    // Confirm no delete buttons
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("filters users by search text and single role select", async () => {
    render(<UserManagement />);
    await screen.findByText("Alex Admin");

    const searchInput = screen.getByLabelText("Search users");
    await userEvent.type(searchInput, "michael");

    await waitFor(() => {
      expect(api.getAdminUsers).toHaveBeenCalledWith({ search: "michael" });
    });

    const roleSelect = screen.getByLabelText("Filter by role");
    await userEvent.selectOptions(roleSelect, "IT_STAFF");

    await waitFor(() => {
      expect(api.getAdminUsers).toHaveBeenCalledWith({ search: "michael", role: "IT_STAFF" });
    });
  });

  it("opens Create User modal, validates inputs, reveals password, and submits", async () => {
    const createUser = vi.spyOn(api, "createAdminUser").mockResolvedValue({
      id: 10,
      name: "Dwight Schrute",
      email: "dwight@example.com",
      role: "IT_STAFF",
      isActive: true,
      mustChangePassword: true,
      createdAt: "2026-09-18T10:00:00.000Z",
      updatedAt: "2026-09-18T10:00:00.000Z",
    });

    render(<UserManagement />);
    await screen.findByText("Alex Admin");

    // Click Create User
    await userEvent.click(screen.getByRole("button", { name: "+ Create User" }));

    // Modal appears
    expect(screen.getByRole("heading", { name: "Create New User" })).toBeInTheDocument();
    expect(screen.getByText(/Initial password must be securely communicated/i)).toBeInTheDocument();

    // Fill form
    await userEvent.type(screen.getByLabelText("Full Name *"), "Dwight Schrute");
    await userEvent.type(screen.getByLabelText("Email Address *"), "dwight@example.com");
    await userEvent.selectOptions(screen.getByLabelText("Role *"), "IT_STAFF");

    const pwdInput = screen.getByPlaceholderText("15–128 characters");
    await userEvent.type(pwdInput, "DwightSecretPassword123!");

    // Test reveal password toggle
    expect(pwdInput).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Reveal" }));
    expect(pwdInput).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(pwdInput).toHaveAttribute("type", "password");

    // Submit
    await userEvent.click(screen.getByRole("button", { name: "Create User" }));

    expect(createUser).toHaveBeenCalledWith({
      name: "Dwight Schrute",
      email: "dwight@example.com",
      role: "IT_STAFF",
      isActive: true,
      initialPassword: "DwightSecretPassword123!",
    });
  });

  it("maps DUPLICATE_EMAIL error to email field during user creation", async () => {
    vi.spyOn(api, "createAdminUser").mockRejectedValue(
      new api.ApiError(409, "DUPLICATE_EMAIL", "A user with this email address already exists.")
    );

    render(<UserManagement />);
    await screen.findByText("Alex Admin");

    await userEvent.click(screen.getByRole("button", { name: "+ Create User" }));
    await userEvent.type(screen.getByLabelText("Full Name *"), "Duplicate Person");
    await userEvent.type(screen.getByLabelText("Email Address *"), "alex@example.com");
    await userEvent.type(screen.getByPlaceholderText("15–128 characters"), "ValidPassword12345!");
    await userEvent.click(screen.getByRole("button", { name: "Create User" }));

    expect(await screen.findByText("A user with this email address already exists.")).toBeInTheDocument();
  });

  it("handles edit mode with disabled self-deactivation and submits changed fields", async () => {
    const updateUser = vi.spyOn(api, "updateAdminUser").mockResolvedValue({
      ...mockUsers[0],
      name: "Alex Administrator",
    });

    render(<UserManagement />);
    await screen.findByText("Alex Admin");

    // Edit self (Alex Admin)
    await userEvent.click(screen.getByRole("button", { name: "Edit user Alex Admin" }));
    expect(screen.getByRole("heading", { name: "Edit User: Alex Admin" })).toBeInTheDocument();

    // Active checkbox is disabled for self
    const activeCheck = screen.getByLabelText("Active Account");
    expect(activeCheck).toBeDisabled();
    expect(screen.getByText("You cannot deactivate your own Administrator account.")).toBeInTheDocument();

    // Modify name only
    const nameInput = screen.getByLabelText("Full Name *");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Alex Administrator");

    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(updateUser).toHaveBeenCalledWith(1, { name: "Alex Administrator" });
  });

  it("shows unassignment warning when deactivating or demoting an IT Staff member", async () => {
    render(<UserManagement />);
    await screen.findByText("Michael Scott");

    await userEvent.click(screen.getByRole("button", { name: "Edit user Michael Scott" }));

    // Uncheck active account
    const activeCheck = screen.getByLabelText("Active Account");
    expect(activeCheck).toBeEnabled();
    await userEvent.click(activeCheck);

    // Warning alert appears
    expect(screen.getByText(/Deactivating this user or changing their role to Requester will automatically unassign/i)).toBeInTheDocument();
  });

  it("opens Set New Initial Password modal from edit view and submits new password", async () => {
    const resetPassword = vi.spyOn(api, "resetAdminUserInitialPassword").mockResolvedValue({
      ...mockUsers[2],
      mustChangePassword: true,
    });

    render(<UserManagement />);
    await screen.findByText("Michael Scott");

    await userEvent.click(screen.getByRole("button", { name: "Edit user Michael Scott" }));

    // Click Set New Initial Password
    await userEvent.click(screen.getByRole("button", { name: "Set New Initial Password" }));

    // Password reset dialog appears
    expect(screen.getByRole("heading", { name: "Set New Initial Password" })).toBeInTheDocument();
    expect(screen.getByText(/Setting a new initial password will immediately revoke all active sessions for/i)).toBeInTheDocument();

    // Type new password
    const pwdInput = screen.getByPlaceholderText("15–128 characters");
    await userEvent.type(pwdInput, "NewMichaelPassword123!");

    // Submit
    await userEvent.click(screen.getByRole("button", { name: "Set Initial Password" }));

    expect(resetPassword).toHaveBeenCalledWith(3, "NewMichaelPassword123!");
    expect(await screen.findByText(/New initial password set for "Michael Scott"/i)).toBeInTheDocument();
  });
});
