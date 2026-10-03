import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Login } from "../../src/components/Login.js";
describe("UI-01 Login", () => {
  it("validates fields and submits credentials once without storage", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<Login onSubmit={submit} />);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(submit).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "An initial password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(submit).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledWith("user@example.com", "An initial password");
    expect(screen.queryByText(/Select Persona|Register/)).not.toBeInTheDocument();
    expect(localStorage.getItem("password")).toBeNull();
  });
  it("shows safe failures and prevents duplicate submissions while busy", async () => {
    let fail!: (e: Error) => void;
    const submit = vi.fn(() => new Promise<void>((_, reject) => { fail = reject; }));
    render(<Login onSubmit={submit} />);
    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "An initial password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled();
    fail(new Error("Unable to sign in. Check your credentials or contact your administrator."));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign in");
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled());
  });
});
