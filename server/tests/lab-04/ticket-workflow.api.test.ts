import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { db, fixture, actionsPath, createBody, versions, completed } from "./api-fixtures.js";

const path = (id: number, route = "status") => `/api/staff/tickets/${id}/${route}`;
const statusBody = (currentStatus: string, expectedWorkflowVersion = 1, extra = {}) => ({ currentStatus, expectedWorkflowVersion, ...extra });

describe("L4-API-09/10/11/16 Ticket integration", () => {
  it.each([
    ["NEW", "OPEN"], ["NEW", "CANCELLED"], ["OPEN", "IN_PROGRESS"], ["OPEN", "CANCELLED"],
    ["IN_PROGRESS", "WAITING_FOR_REQUESTER"], ["IN_PROGRESS", "RESOLVED"], ["IN_PROGRESS", "CANCELLED"],
    ["WAITING_FOR_REQUESTER", "IN_PROGRESS"], ["WAITING_FOR_REQUESTER", "RESOLVED"], ["WAITING_FOR_REQUESTER", "CANCELLED"],
    ["RESOLVED", "CLOSED"], ["RESOLVED", "REOPENED"], ["CLOSED", "REOPENED"], ["REOPENED", "OPEN"], ["REOPENED", "CANCELLED"],
  ] as const)("executes the approved %s to %s edge through the API", async (from, to) => {
    const f = await fixture();
    if (to === "RESOLVED") await completed(f);
    const before = await db.ticket.update({ where: { id: f.ticket.id }, data: { currentStatus: from, ownerId: f.admin.id } });
    const reason = ["CANCELLED", "REOPENED"].includes(to);
    const result = await request(app).patch(path(f.ticket.id)).set(f.staffHeaders)
      .send(statusBody(to, before.workflowVersion, { confirmed: true, ...(reason ? { reason: "Public explanation" } : {}) })).expect(200);
    expect(result.body).toMatchObject({ currentStatus: to, workflowVersion: before.workflowVersion + 1, workCycle: to === "REOPENED" ? 2 : 1 });
    expect(await db.publicComment.count({ where: { ticketId: f.ticket.id } })).toBe(reason ? 1 : 0);
  });
  it("rejects every forbidden status pair, including terminal self-transitions, without changing metadata", async () => {
    const f = await fixture();
    const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
    const allowed: Record<string, string[]> = { NEW: ["OPEN", "CANCELLED"], OPEN: ["IN_PROGRESS", "CANCELLED"],
      IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"], WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
      RESOLVED: ["CLOSED", "REOPENED"], CLOSED: ["REOPENED"], REOPENED: ["OPEN", "CANCELLED"], CANCELLED: [] };
    for (const from of statuses) {
      const before = await db.ticket.update({ where: { id: f.ticket.id }, data: { currentStatus: from, ownerId: f.staff.id } });
      for (const to of statuses.filter(s => !allowed[from].includes(s))) {
        const r = await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody(to, 1, { confirmed: true })).expect(409);
        expect(r.body.code).toBe("INVALID_TRANSITION");
      }
      expect(await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } })).toEqual(before);
    }
  });
  it("reports simultaneous blockers and excludes all previous-cycle work from cancellation", async () => {
    const f = await fixture(); await completed(f, true);
    await request(app).post(actionsPath(f.ticket.id)).set(f.staffHeaders).send(createBody({ expectedWorkflowVersion: 4 })).expect(201);
    await db.ticket.update({ where: { id: f.ticket.id }, data: { currentStatus: "IN_PROGRESS" } });
    const blocked = await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("RESOLVED", 5, { confirmed: true })).expect(409);
    expect(blocked.body.details).toEqual({ eligibleOwner: false, completedActions: 1, incompleteActions: 1, outstandingFollowUps: 1 });
    // Simulate imported historical work; only the current cycle can block cancellation.
    await db.ticket.update({ where: { id: f.ticket.id }, data: { workCycle: 2, currentStatus: "REOPENED" } });
    await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("CANCELLED", 5, { confirmed: true, reason: "Withdrawn" })).expect(200);
    expect(await db.actionTaken.count({ where: { ticketId: f.ticket.id, cycle: 1 } })).toBe(2);
  });
  it("returns real advisory fields and workflow metadata in both Ticket lists", async () => {
    const f = await fixture();
    await request(app).post(`/api/tickets/${f.ticket.id}/resolution-indication`).set(f.requesterHeaders).send({ expectedCycle: 1 }).expect(200);
    const staff = await request(app).get("/api/staff/tickets").query({ search: f.ticket.ticketNumber }).set(f.staffHeaders).expect(200);
    expect(staff.body.data[0]).toMatchObject({ id: f.ticket.id, workflowVersion: 2, workCycle: 1, resolvedAt: null,
      resolutionSuggestedAt: expect.any(String), resolutionSuggestedById: f.requester.id });
    const mine = await request(app).get("/api/tickets").set(f.requesterHeaders).expect(200);
    expect(mine.body.data[0]).toMatchObject({ id: f.ticket.id, workflowVersion: 2, workCycle: 1, resolvedAt: null });
  });
  it.each(["missing", "inactive", "requester", "none", "planned", "progress", "followup"])("rejects resolution with %s blocker, without writes", async scenario => {
    const f = await fixture();
    const a = scenario === "none" ? null : await completed(f, scenario === "followup");
    let version = a?.ticket.workflowVersion ?? 1;
    if (["planned", "progress"].includes(scenario)) {
      const p = (await request(app).post(actionsPath(f.ticket.id)).set(f.staffHeaders).send(createBody({ expectedWorkflowVersion: version })).expect(201)).body;
      version = p.ticket.workflowVersion;
      if (scenario === "progress") version = (await request(app).post(actionsPath(f.ticket.id) + "/" + p.action.id + "/transitions")
        .set(f.staffHeaders).send({ ...versions(p), targetStatus: "IN_PROGRESS" }).expect(200)).body.ticket.workflowVersion;
    }
    await db.ticket.update({ where: { id: f.ticket.id }, data: { currentStatus: "IN_PROGRESS",
      ownerId: scenario === "missing" ? null : scenario === "inactive" ? f.inactive.id : scenario === "requester" ? f.requester.id : f.staff.id } });
    const before = await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } });
    const r = await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("RESOLVED", version, { confirmed: true })).expect(409);
    expect(r.body).toMatchObject({ code: "RESOLUTION_BLOCKED", currentWorkflowVersion: version, details: {
      eligibleOwner: !["missing", "inactive", "requester"].includes(scenario), completedActions: scenario === "none" ? 0 : 1,
      incompleteActions: ["planned", "progress"].includes(scenario) ? 1 : 0, outstandingFollowUps: scenario === "followup" ? 1 : 0 } });
    expect(await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } })).toEqual(before);
  });
  it("resolves, closes and reopens atomically, retaining history but excluding it from the new cycle", async () => {
    const f = await fixture(), a = await completed(f);
    await db.ticket.update({ where: { id: f.ticket.id }, data: { currentStatus: "IN_PROGRESS", ownerId: f.staff.id,
      resolutionSuggestedAt: new Date(), resolutionSuggestedById: f.requester.id } });
    const beforeActions = await db.actionTaken.findMany({ where: { ticketId: f.ticket.id } });
    const beforeHistory = await db.actionTakenRevision.findMany({ where: { actionId: a.action.id }, orderBy: { version: "asc" } });
    const resolved = await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("RESOLVED", 4, { confirmed: true })).expect(200);
    expect(resolved.body).toMatchObject({ workflowVersion: 5, workCycle: 1, resolvedAt: expect.any(String), resolutionBlockers: { completedActions: 1 } });
    const closed = await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("CLOSED", 5, { confirmed: true })).expect(200);
    expect(closed.body.resolvedAt).toBe(resolved.body.resolvedAt);
    const reopened = await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("REOPENED", 6, { confirmed: true, reason: "Issue returned" })).expect(200);
    expect(reopened.body).toMatchObject({ workflowVersion: 7, workCycle: 2, resolvedAt: null, resolutionSuggestedAt: null, resolutionSuggestedById: null,
      resolutionBlockers: { completedActions: 0 } });
    expect(await db.publicComment.count({ where: { ticketId: f.ticket.id, body: "Issue returned", authorId: f.staff.id } })).toBe(1);
    expect(await db.actionTaken.findMany({ where: { ticketId: f.ticket.id } })).toEqual(beforeActions);
    expect(await db.actionTakenRevision.findMany({ where: { actionId: a.action.id }, orderBy: { version: "asc" } })).toEqual(beforeHistory);
    const old = await request(app).patch(actionsPath(f.ticket.id) + "/" + a.action.id).set(f.staffHeaders)
      .send({ expectedWorkflowVersion: 7, expectedVersion: 3, result: "Correction", changeReason: "Review" }).expect(409);
    expect(old.body.code).toBe("TICKET_CYCLE_CONFLICT");
    await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("OPEN", 7)).expect(200);
    await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("IN_PROGRESS", 8)).expect(200);
    expect((await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("RESOLVED", 9, { confirmed: true })).expect(409)).body.details.completedActions).toBe(0);
  });
  it("blocks cancellation until unfinished Actions are explicitly cancelled", async () => {
    const f = await fixture();
    const a = (await request(app).post(actionsPath(f.ticket.id)).set(f.staffHeaders).send(createBody()).expect(201)).body;
    const r = await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("CANCELLED", 2, { confirmed: true, reason: "Duplicate" })).expect(409);
    expect(r.body).toMatchObject({ code: "ACTIONS_INCOMPLETE", details: { incompleteActions: 1 } });
    expect(await db.publicComment.count({ where: { ticketId: f.ticket.id } })).toBe(0);
    await request(app).post(actionsPath(f.ticket.id) + "/" + a.action.id + "/transitions").set(f.staffHeaders)
      .send({ ...versions(a), targetStatus: "CANCELLED", confirmed: true, reason: "Not needed" }).expect(200);
    await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("CANCELLED", 3, { confirmed: true, reason: "Duplicate" })).expect(200);
    expect(await db.actionTaken.count({ where: { ticketId: f.ticket.id, status: "CANCELLED" } })).toBe(1);
    expect((await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("REOPENED", 4, { confirmed: true, reason: "Retry" })).expect(409)).body.code).toBe("INVALID_TRANSITION");
  });
  it("allows cancellation with completed follow-up and preserves the Action", async () => {
    const f = await fixture(); await completed(f, true);
    await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("CANCELLED", 4, { confirmed: true, reason: "Withdrawn" })).expect(200);
    expect(await db.actionTaken.count({ where: { ticketId: f.ticket.id, status: "COMPLETED", followUpRequired: true } })).toBe(1);
  });
  it.each(["RESOLVED", "CLOSED"] as const)("preserves legacy %s zero-action Tickets and unknown resolution dates", async currentStatus => {
    const f = await fixture(); await db.ticket.update({ where: { id: f.ticket.id }, data: { currentStatus } });
    let version = 1;
    if (currentStatus === "RESOLVED") {
      const closed = await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("CLOSED", version++, { confirmed: true })).expect(200);
      expect(closed.body.resolvedAt).toBeNull();
    }
    const reopened = await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("REOPENED", version, { confirmed: true, reason: "Return" })).expect(200);
    expect(reopened.body.workCycle).toBe(2);
    expect(await db.actionTaken.count({ where: { ticketId: f.ticket.id } })).toBe(0);
  });
  it("checks stale versions before no-op and already-assigned handling", async () => {
    const f = await fixture();
    const claimed = await request(app).post(path(f.ticket.id, "claim")).set(f.staffHeaders).send({ expectedWorkflowVersion: 1 }).expect(200);
    for (const route of ["claim", "owner", "priority", "status"]) {
      const body = route === "owner" ? { ownerId: f.staff.id } : route === "priority" ? { itPriority: "MEDIUM" } : route === "status" ? { currentStatus: "OPEN" } : {};
      const r = await request(app)[route === "claim" ? "post" : "patch"](path(f.ticket.id, route)).set(f.staffHeaders).send({ ...body, expectedWorkflowVersion: 1 }).expect(409);
      expect(r.body).toMatchObject({ code: "TICKET_VERSION_CONFLICT", currentWorkflowVersion: 2 });
    }
    const noop = await request(app).patch(path(f.ticket.id, "owner")).set(f.staffHeaders).send({ ownerId: f.staff.id, expectedWorkflowVersion: 2 }).expect(200);
    expect(noop.body.updatedAt).toBe(claimed.body.updatedAt); expect(noop.body.workflowVersion).toBe(2);
    const priority = await request(app).patch(path(f.ticket.id, "priority")).set(f.adminHeaders).send({ itPriority: "MEDIUM", expectedWorkflowVersion: 2 }).expect(200);
    expect(priority.body.updatedAt).toBe(claimed.body.updatedAt); expect(priority.body.permittedTransitions).toEqual([]);
  });
  it("rejects deprecated bodies, invalid versions, extra keys, unsaved reasons and nonboolean confirmation", async () => {
    const f = await fixture();
    for (const version of [undefined, null, "1", 0, -1, 1.5, 2147483648]) {
      for (const [route, body] of [["claim", {}], ["owner", { ownerId: null }], ["priority", { itPriority: "HIGH" }], ["status", { currentStatus: "OPEN" }]] as const)
        await request(app)[route === "claim" ? "post" : "patch"](path(f.ticket.id, route)).set(f.staffHeaders).send({ ...body, expectedWorkflowVersion: version }).expect(400);
      await request(app).post(`/api/tickets/${f.ticket.id}/resolution-indication`).set(f.requesterHeaders).send({ expectedCycle: version }).expect(400);
    }
    for (const extra of [{ reason: "Unsaved" }, { confirmed: "true" }, { workCycle: 5 }])
      await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("OPEN", 1, extra)).expect(400);
    expect((await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } })).workflowVersion).toBe(1);
  });
  it("keeps indication advisory, cycle-scoped, idempotent and ownership-protected", async () => {
    const f = await fixture(), url = `/api/tickets/${f.ticket.id}/resolution-indication`;
    await request(app).post(url).set(f.otherHeaders).send({ expectedCycle: 1 }).expect(404);
    const first = await request(app).post(url).set(f.requesterHeaders).send({ expectedCycle: 1 }).expect(200);
    expect(first.body).toMatchObject({ currentStatus: "NEW", workflowVersion: 2, workCycle: 1 });
    expect((await request(app).post(url).set(f.requesterHeaders).send({ expectedCycle: 1 }).expect(200)).body).toEqual(first.body);
    await db.ticket.update({ where: { id: f.ticket.id }, data: { currentStatus: "RESOLVED" } });
    expect((await request(app).post(url).set(f.requesterHeaders).send({ expectedCycle: 1 }).expect(409)).body.code).toBe("TICKET_NOT_ACTIVE");
    await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("REOPENED", 2, { confirmed: true, reason: "Again" })).expect(200);
    expect((await request(app).post(url).set(f.requesterHeaders).send({ expectedCycle: 1 }).expect(409)).body).toMatchObject({ code: "TICKET_CYCLE_CONFLICT", currentCycle: 2 });
    expect((await request(app).post(url).set(f.requesterHeaders).send({ expectedCycle: 2 }).expect(200)).body).toMatchObject({ workflowVersion: 4, workCycle: 2 });
  });
  it("uses identical policy snapshots in reads and writes without offering Admin/Requester transitions", async () => {
    const f = await fixture();
    const changed = await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("OPEN")).expect(200);
    const staff = await request(app).get(`/api/staff/tickets/${f.ticket.id}`).set(f.staffHeaders).expect(200);
    expect(staff.body).toEqual(changed.body);
    expect(staff.body.permittedTransitions).toContainEqual({ to: "IN_PROGRESS", requiresConfirmation: false, requiresReason: false, enabled: false, blockers: ["OWNER_REQUIRED"] });
    for (const headers of [f.requesterHeaders, f.adminHeaders]) {
      const r = await request(app).get(`/api/tickets/${f.ticket.id}`).set(headers).expect(200);
      expect(r.body.permittedTransitions).toEqual([]); expect(r.body.resolutionBlockers).toEqual(staff.body.resolutionBlockers);
    }
  });
  it.each(["workCycle", "workflowVersion"])("rolls back reason and metadata on %s overflow", async field => {
    const f = await fixture(); await db.ticket.update({ where: { id: f.ticket.id }, data: { currentStatus: "RESOLVED", [field]: 2147483647 } });
    const before = await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } });
    await request(app).patch(path(f.ticket.id)).set(f.staffHeaders).send(statusBody("REOPENED", before.workflowVersion, { confirmed: true, reason: "Overflow" })).expect(500);
    expect(await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } })).toEqual(before);
    expect(await db.publicComment.count({ where: { ticketId: f.ticket.id } })).toBe(0);
  });
});

