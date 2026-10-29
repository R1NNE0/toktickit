import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionsTaken } from "../../src/components/ActionsTaken.js";
import * as api from "../../src/actions-api.js";
import * as legacy from "../../src/api.js";
import { canLeaveActions, validateActionFields, initialActionFields } from "../../src/action-ui.js";
import { staff, admin, requester, ticket, action, page, mutation } from "./fixtures.js";

const show = (user = staff, value = ticket) => {
  vi.mocked(api.getActionTicket).mockResolvedValue(value);
  return render(<ActionsTaken ticket={value} user={user} onTicketChange={vi.fn()} />);
};
const input = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
async function open(name: string) { await userEvent.click(await screen.findByRole("button", { name })); return screen.getByRole("dialog"); }
async function createForm() { await open("Create Action"); await waitFor(() => expect(screen.getByLabelText(/Assignee \(required\)/)).toBeEnabled()); }
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(api, "getTicketActions").mockResolvedValue(page([action]));
  vi.spyOn(api, "getActionTicket").mockResolvedValue(ticket);
  vi.spyOn(api, "getAction").mockResolvedValue(action);
  vi.spyOn(api, "getActionHistory").mockResolvedValue(page([]));
  vi.spyOn(legacy, "getStaffAssignees").mockResolvedValue([staff, admin] as legacy.Assignee[]);
  vi.spyOn(api, "createAction").mockResolvedValue(mutation({ id: 6, version: 1 }));
  vi.spyOn(api, "editAction").mockResolvedValue(mutation({ version: 3 }));
  vi.spyOn(api, "transitionAction").mockResolvedValue(mutation({ status: "IN_PROGRESS", version: 3 }));
});
describe("L4-UI-01/06 Actions Taken", () => {
  it.each([staff, admin])("shows shared work and privileged controls to $role without misattributing performance", async user => {
    show(user); await screen.findByRole("heading", { name: "Action #5" });
    expect(screen.getByText("Inspect router")).toBeInTheDocument();
    expect(screen.getByText("Not yet performed")).toBeInTheDocument();
    expect(screen.getByText("Alex Admin")).toBeInTheDocument();
    expect(screen.getByText("Casey Staff")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Action" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Action" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View history" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start Action" }) !== null).toBe(user.id === action.assignee.id);
    expect(screen.getByText(/Asia\/Bangkok/)).toBeInTheDocument();
    expect(screen.getByText("28 Oct 2026, 07:00")).toBeInTheDocument();
  });
  it("keeps Requesters read-only, including cancelled and historical work, and renders literal text", async () => {
    vi.mocked(api.getTicketActions).mockResolvedValue(page([{ ...action, description: "<script>alert(1)</script>", cycle: 1, status: "CANCELLED", cancellationReason: "Not needed" },
      { ...action, id: 6, cycle: 2 }]));
    show(requester, { ...ticket, workCycle: 2 }); await screen.findByText("<script>alert(1)</script>");
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByRole("heading", { name: "Work cycle 1 — Historical" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Work cycle 2 — Current" })).toBeInTheDocument();
    for (const label of ["Create Action", "Edit Action", "Cancel Action", "Start Action", "View history"]) expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
    expect(api.getActionHistory).not.toHaveBeenCalled(); expect(legacy.getStaffAssignees).not.toHaveBeenCalled();
  });
  it.each(["RESOLVED", "CLOSED", "CANCELLED"] as const)("keeps Actions read-only on a %s Ticket", async currentStatus => {
    show(staff, { ...ticket, currentStatus }); await screen.findByText("Inspect router");
    expect(screen.queryByRole("button", { name: "Create Action" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Action" })).toBeNull();
    expect(screen.getByRole("button", { name: "View history" })).toBeInTheDocument();
  });
  it("blocks historical/cancelled mutations but allows recovery editing for an unavailable current assignee", async () => {
    vi.mocked(api.getTicketActions).mockResolvedValue(page([{ ...action, cycle: 1 }, { ...action, id: 6, cycle: 2, status: "CANCELLED" },
      { ...action, id: 7, cycle: 2, assignee: { ...staff, isActive: false } }]));
    show(staff, { ...ticket, workCycle: 2 }); await screen.findByText(/Unavailable; reassignment needed/);
    expect(screen.getAllByRole("button", { name: "Edit Action" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Start Action" })).toBeNull();
    await open("Edit Action"); input(/Description/, "More diagnostic detail");
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await waitFor(() => expect(api.editAction).toHaveBeenCalled());
    expect(vi.mocked(api.editAction).mock.calls[0][2]).not.toHaveProperty("assigneeId");
  });
  it("validates create and follow-up fields, focuses errors, and submits only approved values", async () => {
    show(); await createForm();
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create Action" }));
    expect(screen.getByLabelText(/Description/)).toHaveFocus(); expect(screen.getByLabelText(/Description/)).toHaveAttribute("aria-invalid", "true");
    input(/Description/, "  Inspect access point  ");
    await userEvent.click(screen.getByLabelText("Follow-up required"));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create Action" }));
    expect(screen.getByLabelText(/Follow-up note/)).toHaveFocus(); expect(api.createAction).not.toHaveBeenCalled();
    input(/Follow-up note/, "Check tomorrow"); input(/Attachment notes/, "See existing report");
    await userEvent.selectOptions(screen.getByLabelText(/Assignee \(required\)/), "3");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create Action" }));
    await waitFor(() => expect(api.createAction).toHaveBeenCalledTimes(1));
    expect(api.createAction).toHaveBeenCalledWith(101, { clientRequestId: expect.any(String), expectedWorkflowVersion: 7,
      description: "Inspect access point", assigneeId: 3, result: null, followUpRequired: true, followUpNote: "Check tomorrow", attachmentNotes: "See existing report" });
    expect(await screen.findByText("Action #6 saved.")).toBeInTheDocument();
  });
  it("counts Unicode code points and validates exact length boundaries", () => {
    const f = { ...initialActionFields(2), description: "😀".repeat(4000), attachmentNotes: "x".repeat(2000) };
    expect(validateActionFields("create", f, false)).toEqual({});
    expect(validateActionFields("create", { ...f, description: f.description + "a", attachmentNotes: f.attachmentNotes + "a" }, false)).toHaveProperty("description");
    expect(validateActionFields("complete", { ...f, result: " " }, false)).toHaveProperty("result");
  });
  it("allows explicit reassignment and uses both captured versions", async () => {
    show(); await open("Edit Action"); await waitFor(() => expect(screen.getByLabelText(/Assignee \(required\)/)).toBeEnabled());
    await userEvent.selectOptions(screen.getByLabelText(/Assignee \(required\)/), "3");
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await waitFor(() => expect(api.editAction).toHaveBeenCalledWith(101, 5, expect.objectContaining({ assigneeId: 3, expectedWorkflowVersion: 7, expectedVersion: 2 })));
  });
  it("requires an explained completed correction, retains follow-up notes and never rewrites assignment", async () => {
    vi.mocked(api.getTicketActions).mockResolvedValue(page([{ ...action, status: "COMPLETED", result: "Fixed", performedBy: staff,
      completedAt: ticket.updatedAt, followUpRequired: true, followUpNote: "Verify later" }]));
    show(); await open("Correct Action");
    expect(screen.queryByLabelText(/Assignee \(required\)/)).toBeNull();
    await userEvent.click(screen.getByLabelText("Follow-up required"));
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));
    expect(screen.getByLabelText(/Change reason/)).toHaveFocus();
    input(/Change reason/, "Follow-up confirmed");
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await waitFor(() => expect(api.editAction).toHaveBeenCalled());
    expect(vi.mocked(api.editAction).mock.calls[0][2]).toMatchObject({ followUpRequired: false, followUpNote: "Verify later", changeReason: "Follow-up confirmed" });
    expect(vi.mocked(api.editAction).mock.calls[0][2]).not.toHaveProperty("assigneeId");
  });
  it.each([staff, admin])("permits the assigned $role to complete with result and follow-up validation", async user => {
    vi.mocked(api.getTicketActions).mockResolvedValue(page([{ ...action, status: "IN_PROGRESS", assignee: user }]));
    show(user); await open("Complete Action");
    expect(screen.getByText(new RegExp(`Completing as ${user.name}`))).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Complete Action" }));
    expect(screen.getByLabelText(/Result/)).toHaveFocus(); input(/Result/, "Connection restored");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Complete Action" }));
    await waitFor(() => expect(api.transitionAction).toHaveBeenCalledWith(101, 5, { expectedWorkflowVersion: 7, expectedVersion: 2,
      targetStatus: "COMPLETED", result: "Connection restored", followUpRequired: false, followUpNote: null, attachmentNotes: null }));
  });
  it("starts assigned work and cancels only after a shared reason and explicit confirmation", async () => {
    const view = show(); await open("Start Action");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Start Action" }));
    await waitFor(() => expect(api.transitionAction).toHaveBeenCalledWith(101, 5, { expectedWorkflowVersion: 7, expectedVersion: 2, targetStatus: "IN_PROGRESS" }));
    view.unmount(); show(); await open("Cancel Action");
    await userEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    expect(screen.getByLabelText(/Cancellation reason/)).toHaveFocus(); input(/Cancellation reason/, "Alternative selected");
    await userEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    await waitFor(() => expect(api.transitionAction).toHaveBeenLastCalledWith(101, 5, { expectedWorkflowVersion: 7, expectedVersion: 2, targetStatus: "CANCELLED", confirmed: true, reason: "Alternative selected" }));
  });
  it("locks uncertain creation and retries the identical payload and UUID, then displays the authoritative replay", async () => {
    vi.mocked(api.createAction).mockRejectedValueOnce(new Error("Response lost")).mockResolvedValueOnce({ ...mutation({ status: "COMPLETED", version: 4, performedBy: staff, result: "Already completed" }), replayed: true });
    show(); await createForm(); input(/Description/, "Retry-safe work");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create Action" }));
    await screen.findByText(/creation result is uncertain/);
    expect(screen.getByLabelText(/Description/)).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Retry exact submission" }));
    await screen.findByText(/recovered from your previous submission/);
    expect(api.createAction).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.createAction).mock.calls[0]).toEqual(vi.mocked(api.createAction).mock.calls[1]);
    expect(await screen.findByText("Already completed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start Action" })).toBeNull();
  });
  it("retains a confirmed saved Action when the following refresh fails, and focuses the section", async () => {
    show(); await createForm(); input(/Description/, "Confirmed work");
    vi.mocked(api.createAction).mockResolvedValue(mutation({ id: 6, description: "Confirmed work" }));
    vi.mocked(api.getTicketActions).mockRejectedValue(new Error("Read unavailable"));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create Action" }));
    await screen.findByText(/Unable to load Actions Taken/);
    expect(within(screen.getByRole("complementary", { name: "Last saved Action" })).getByText("Confirmed work")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Actions Taken" })).toHaveFocus();
    expect(screen.queryByText(/No Actions Taken have/)).toBeNull();
  });
  it("uses a new creation key only after confirmed success and a new form", async () => {
    show(); await createForm(); input(/Description/, "First work");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create Action" }));
    await screen.findByText("Action #6 saved."); await createForm();
    expect(screen.getByLabelText(/Description/)).toHaveValue(""); input(/Description/, "Second work");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create Action" }));
    await waitFor(() => expect(api.createAction).toHaveBeenCalledTimes(2));
    const calls = vi.mocked(api.createAction).mock.calls;
    expect(calls[1][1].clientRequestId).not.toBe(calls[0][1].clientRequestId);
  });
  it("retains a denied mutation draft without offering another unauthorized submission", async () => {
    vi.mocked(api.editAction).mockRejectedValue(new legacy.ApiError(403, "FORBIDDEN", "Forbidden"));
    show(); await open("Edit Action"); input(/Description/, "Retain for review");
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await screen.findByText(/Access denied. Close this form/);
    expect(screen.getByLabelText(/Description/)).toHaveValue("Retain for review");
    expect(screen.getByRole("button", { name: "Save Action" })).toBeDisabled();
    expect(api.editAction).toHaveBeenCalledTimes(1);
  });
  it("blocks creation while the directory is unavailable and supports an explicit retry", async () => {
    vi.mocked(legacy.getStaffAssignees).mockRejectedValueOnce(new Error("Directory unavailable"));
    show(); await open("Create Action"); await screen.findByText(/Unable to load assignees/);
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Create Action" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Retry assignees" }));
    await waitFor(() => expect(screen.getByLabelText(/Assignee \(required\)/)).toBeEnabled());
    expect(screen.getByRole("option", { name: "Alex Admin (Administrator)" })).toBeInTheDocument();
  });
  it("shows privileged history denial without cached snapshots or an endless retry", async () => {
    vi.mocked(api.getActionHistory).mockRejectedValue(new legacy.ApiError(403, "FORBIDDEN", "Forbidden"));
    show(); await open("View history"); await screen.findByText("History unavailable or access denied.");
    expect(screen.queryByRole("button", { name: "Retry history" })).toBeNull();
    expect(screen.queryByText(/Version 1/)).toBeNull();
  });
  it("blocks duplicate submits and closing/navigation while saving, and restores trigger focus", async () => {
    let finish!: (v: api.ActionMutation) => void;
    vi.mocked(api.createAction).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    show(); await createForm(); input(/Description/, "Slow work");
    const button = within(screen.getByRole("dialog")).getByRole("button", { name: "Create Action" });
    fireEvent.click(button); fireEvent.click(button);
    expect(api.createAction).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" }); expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(canLeaveActions()).toBe(false);
    await act(async () => finish(mutation()));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("retains stale drafts, reloads separately, and requires explicit review and resubmission", async () => {
    vi.mocked(api.editAction).mockRejectedValueOnce(new legacy.ApiError(409, "TICKET_VERSION_CONFLICT", "Changed"));
    show(); await open("Edit Action"); input(/Description/, "My retained draft");
    await userEvent.click(screen.getByRole("button", { name: "Save Action" })); await screen.findByText(/Your draft is retained/);
    vi.mocked(api.getActionTicket).mockResolvedValue({ ...ticket, workflowVersion: 10 });
    vi.mocked(api.getAction).mockResolvedValue({ ...action, description: "Someone else's update", version: 4 });
    await userEvent.click(screen.getByRole("button", { name: "Reload latest data" }));
    await screen.findByText("Someone else's update"); expect(screen.getByLabelText(/Description/)).toHaveValue("My retained draft");
    expect(screen.getByRole("button", { name: "Save Action" })).toBeDisabled(); expect(api.editAction).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Use latest versions after review" }));
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await waitFor(() => expect(api.editAction).toHaveBeenLastCalledWith(101, 5, expect.objectContaining({ description: "My retained draft", expectedVersion: 4, expectedWorkflowVersion: 10 })));
  });
  it("refuses to reapply a historical-cycle draft after conflict reload", async () => {
    vi.mocked(api.editAction).mockRejectedValue(new legacy.ApiError(409, "TICKET_CYCLE_CONFLICT", "Reopened"));
    show(); await open("Edit Action"); input(/Description/, "Retained"); await userEvent.click(screen.getByRole("button", { name: "Save Action" }));
    vi.mocked(api.getActionTicket).mockResolvedValue({ ...ticket, workCycle: 2, workflowVersion: 12 });
    await userEvent.click(await screen.findByRole("button", { name: "Reload latest data" }));
    await screen.findByText(/This operation is no longer permitted/);
    expect(screen.queryByRole("button", { name: "Use latest versions after review" })).toBeNull();
    expect(screen.getByLabelText(/Description/)).toHaveValue("Retained");
  });
  it("maps server field errors and retains input after a confirmed rejection", async () => {
    vi.mocked(api.createAction).mockRejectedValue(new legacy.ApiError(400, "VALIDATION_ERROR", "Check description", { fields: { description: "Invalid description" } }));
    show(); await createForm(); input(/Description/, "Keep this draft");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create Action" }));
    await screen.findByText("Invalid description"); expect(screen.getByLabelText(/Description/)).toHaveFocus(); expect(screen.getByLabelText(/Description/)).toHaveValue("Keep this draft");
  });
  it.each([403,404,500])("distinguishes %s read failures from empty results", async status => {
    vi.mocked(api.getTicketActions).mockRejectedValue(new legacy.ApiError(status, "ERROR", "Read failed"));
    show(); await screen.findByRole("alert");
    expect(screen.queryByText(/No Actions Taken have/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry Actions" }) !== null).toBe(status === 500);
    if (status === 500) { vi.mocked(api.getTicketActions).mockResolvedValue(page([])); await userEvent.click(screen.getByRole("button", { name: "Retry Actions" })); await screen.findByText(/No Actions Taken have/); }
  });
  it("loads bounded Action pages and resets page on page-size changes", async () => {
    vi.mocked(api.getTicketActions).mockImplementation(async (_id, current = 1) => page([action], current, 2));
    show(); await screen.findByText("Inspect router"); await userEvent.click(screen.getByRole("button", { name: "Next Actions" }));
    await waitFor(() => expect(api.getTicketActions).toHaveBeenLastCalledWith(101, 2, 20, expect.any(AbortSignal)));
    await waitFor(() => expect(screen.getByLabelText(/Actions per page/)).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText(/Actions per page/), "50");
    await waitFor(() => expect(api.getTicketActions).toHaveBeenLastCalledWith(101, 1, 50, expect.any(AbortSignal)));
  });
  it("loads privileged history lazily with paginated, read-only snapshots", async () => {
    const { assignee, createdBy, performedBy, ...rest } = action;
    const revision: api.ActionRevision = { id: 8, actionId: 5, version: 1, operation: "CREATE", actor: admin, occurredAt: ticket.createdAt,
      changeReason: null, snapshot: { ...rest, version: 1, assigneeId: assignee.id, createdById: createdBy.id, performedById: null } };
    vi.mocked(api.getActionHistory).mockResolvedValue(page([revision], 1, 2));
    show(); await screen.findByText("Inspect router"); expect(api.getActionHistory).not.toHaveBeenCalled(); await open("View history");
    await screen.findByText(/Version 1 · Create/); expect(screen.queryByRole("button", { name: "Save Action" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Next revisions" }));
    await waitFor(() => expect(api.getActionHistory).toHaveBeenLastCalledWith(101, 5, 2, expect.any(AbortSignal)));
  });
  it("guards dirty navigation and Escape, traps focus, and restores it on dismissal", async () => {
    show(); await createForm(); input(/Description/, "Draft"); vi.mocked(window.confirm).mockReturnValue(false);
    expect(canLeaveActions()).toBe(false); fireEvent.keyDown(document, { key: "Escape" }); expect(screen.getByRole("dialog")).toBeInTheDocument();
    const close = within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }); close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true }); expect(screen.getByRole("button", { name: "Discard / close" })).toHaveFocus();
    vi.mocked(window.confirm).mockReturnValue(true); fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.getByRole("button", { name: "Create Action" })).toHaveFocus();
  });
  it("clears private drafts and rows on session expiry", async () => {
    show(); await createForm(); input(/Description/, "Private draft");
    act(() => window.dispatchEvent(new Event("toktickit:session-expired")));
    expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.queryByText("Inspect router")).toBeNull();
    expect(screen.getByText(/Please sign in again to view Actions/)).toBeInTheDocument();
  });
  it("ignores obsolete list responses after navigation to another Ticket", async () => {
    let finish!: (value: api.ActionPage<api.ActionRecord>) => void;
    vi.mocked(api.getTicketActions).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const view = show(); expect(screen.getByText(/Loading Actions Taken/)).toBeInTheDocument();
    view.rerender(<ActionsTaken ticket={{ ...ticket, id: 102 }} user={staff} onTicketChange={vi.fn()} />);
    await screen.findByText("Inspect router"); await act(async () => finish(page([{ ...action, description: "OLD PRIVATE RESPONSE" }])));
    expect(screen.queryByText("OLD PRIVATE RESPONSE")).toBeNull();
  });
});
