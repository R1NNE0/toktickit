import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequesterProvider, useRequester } from "../../src/context/RequesterContext.js";
import { RequesterSelector } from "../../src/components/RequesterSelector.js";
import { Header } from "../../src/components/Header.js";
import * as api from "../../src/api.js";

const mockRequesters: api.RequesterUser[] = [
  {
    id: 1,
    name: "Jennifer Anderson",
    email: "jennifer.anderson@example.com",
    isActive: true,
  },
  {
    id: 2,
    name: "Michael Brown",
    email: "michael.brown@example.com",
    isActive: true,
  },
];

function TestConsumer() {
  const { currentRequester, isSwitching, clearRequester } = useRequester();
  return (
    <div>
      <Header />
      {!currentRequester || isSwitching ? (
        <RequesterSelector />
      ) : (
        <div>
          <div data-testid="active-user-name">{currentRequester.name}</div>
          <button onClick={clearRequester}>Log out context</button>
        </div>
      )}
    </div>
  );
}

describe("Lab 2 (Issue #3) - RequesterContext & Selection UI", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("loads and displays active requesters in dropdown selector", async () => {
    vi.spyOn(api, "getActiveRequesters").mockResolvedValue(mockRequesters);

    render(
      <RequesterProvider>
        <TestConsumer />
      </RequesterProvider>
    );

    // Shows loading then selector card
    expect(
      await screen.findByText(/Select Development Requester/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Jennifer Anderson \(jennifer.anderson@example.com\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Michael Brown \(michael.brown@example.com\)/i)
    ).toBeInTheDocument();
  });

  it("selecting a requester updates context state, header pill, and persists to localStorage", async () => {
    vi.spyOn(api, "getActiveRequesters").mockResolvedValue(mockRequesters);

    render(
      <RequesterProvider>
        <TestConsumer />
      </RequesterProvider>
    );

    await screen.findByText(/Select Development Requester/i);

    const select = screen.getByLabelText(/Development Requester/i);
    await userEvent.selectOptions(select, "2");

    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await userEvent.click(continueBtn);

    // Context should update
    expect(await screen.findByTestId("active-user-name")).toHaveTextContent(
      "Michael Brown"
    );
    expect(localStorage.getItem("toktickit_selected_requester_id")).toBe("2");
  });

  it("clicking Switch opens the selection screen to switch personas", async () => {
    localStorage.setItem("toktickit_selected_requester_id", "1");
    vi.spyOn(api, "getActiveRequesters").mockResolvedValue(mockRequesters);

    render(
      <RequesterProvider>
        <TestConsumer />
      </RequesterProvider>
    );

    // Starts with Jennifer
    expect(await screen.findByTestId("active-user-name")).toHaveTextContent(
      "Jennifer Anderson"
    );

    // Click Switch in Header
    const switchBtn = screen.getByRole("button", { name: /Switch/i });
    await userEvent.click(switchBtn);

    // Selector should now be visible
    expect(
      await screen.findByText(/Select Development Requester/i)
    ).toBeInTheDocument();

    // Select Michael
    const select = screen.getByLabelText(/Development Requester/i);
    await userEvent.selectOptions(select, "2");
    await userEvent.click(screen.getByRole("button", { name: /Continue/i }));

    // User is now Michael
    expect(await screen.findByTestId("active-user-name")).toHaveTextContent(
      "Michael Brown"
    );
    expect(localStorage.getItem("toktickit_selected_requester_id")).toBe("2");
  });

  it("displays error message and allows retry when API fails", async () => {
    vi.spyOn(api, "getActiveRequesters").mockRejectedValue(
      new Error("Database connection timeout")
    );

    render(
      <RequesterProvider>
        <TestConsumer />
      </RequesterProvider>
    );

    expect(
      await screen.findByText(/Database connection timeout/i)
    ).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /Retry/i });
    expect(retryBtn).toBeInTheDocument();
  });
});
