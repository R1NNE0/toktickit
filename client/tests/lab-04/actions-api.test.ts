import { beforeEach, describe, expect, it, vi } from "vitest";
import * as legacy from "../../src/api.js";
import { createAction, editAction, transitionAction, getTicketActions, getActionHistory } from "../../src/actions-api.js";
beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(legacy, "authFetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })); });
describe("Actions API session wrapper contract", () => {
  it("uses the existing authenticated transport and sends explicit versions without identity overrides", async () => {
    const payload = { description: "Work", clientRequestId: "00000000-0000-4000-8000-000000000001", expectedWorkflowVersion: 7 };
    await createAction(101, payload);
    expect(legacy.authFetch).toHaveBeenCalledWith("/api/tickets/101/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    vi.mocked(legacy.authFetch).mockResolvedValue(new Response("{}"));
    await editAction(101, 5, { expectedWorkflowVersion: 8, expectedVersion: 1, result: null });
    expect(legacy.authFetch).toHaveBeenLastCalledWith("/api/tickets/101/actions/5", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ expectedWorkflowVersion: 8, expectedVersion: 1, result: null }) }));
    vi.mocked(legacy.authFetch).mockResolvedValue(new Response("{}"));
    await transitionAction(101, 5, { expectedWorkflowVersion: 9, expectedVersion: 2, targetStatus: "IN_PROGRESS" });
    expect(legacy.authFetch).toHaveBeenLastCalledWith("/api/tickets/101/actions/5/transitions", expect.objectContaining({ method: "POST" }));
  });
  it("requests all cycles and bounded history pages with cancellation signals", async () => {
    const signal = new AbortController().signal;
    await getTicketActions(101, 2, 50, signal);
    expect(legacy.authFetch).toHaveBeenCalledWith("/api/tickets/101/actions?page=2&pageSize=50", { signal });
    vi.mocked(legacy.authFetch).mockResolvedValue(new Response("{}"));
    await getActionHistory(101, 5, 2, signal);
    expect(legacy.authFetch).toHaveBeenLastCalledWith("/api/tickets/101/actions/5/history?page=2&pageSize=20", { signal });
  });
  it("preserves conflict codes/current versions and field associations for recovery", async () => {
    vi.mocked(legacy.authFetch).mockResolvedValue(new Response(JSON.stringify({ code: "ACTION_VERSION_CONFLICT", error: "Changed",
      currentWorkflowVersion: 9, currentActionVersion: 4, currentCycle: 2, details: { fields: { result: "Required" } } }), { status: 409 }));
    await expect(editAction(101, 5, { expectedVersion: 1, expectedWorkflowVersion: 1, result: "X" })).rejects.toMatchObject({ status: 409, code: "ACTION_VERSION_CONFLICT",
      currentWorkflowVersion: 9, currentActionVersion: 4, currentCycle: 2, details: { fields: { result: "Required" } } });
  });
});
