import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangePassword } from "../../src/components/ChangePassword.js";
describe("UI-02 Change password", () => {
  it("provides no bypass in mandatory mode and rejects mismatched confirmation", async () => {
    const submit = vi.fn();
    render(<ChangePassword mandatory onSubmit={submit} />);
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Current password"), "Initial password 123");
    await userEvent.type(screen.getByLabelText("New password"), "Changed password 456");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "Different password 789");
    await userEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("match");
  });
  it("submits exact passwords, clears fields and permits voluntary cancel", async () => {
    const submit = vi.fn().mockResolvedValue(undefined), cancel = vi.fn();
    render(<ChangePassword mandatory={false} onSubmit={submit} onCancel={cancel} />);
    await userEvent.type(screen.getByLabelText("Current password"), "Initial password 123");
    await userEvent.type(screen.getByLabelText("New password"), "  Changed password 456  ");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "  Changed password 456  ");
    await userEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect(submit).toHaveBeenCalledWith({ currentPassword: "Initial password 123", newPassword: "  Changed password 456  ", confirmPassword: "  Changed password 456  " });
    expect(screen.getByLabelText("New password")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalledOnce();
  });
});
