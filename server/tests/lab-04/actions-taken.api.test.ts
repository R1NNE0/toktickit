import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { db, fixture, actionsPath, createBody, versions } from "./api-fixtures.js";

describe("L4-API-01/02/03/04/05/15 Actions contract", () => {
  it("coordinates existing Ticket writers with Action versions using explicit versioned request formats", async () => {
    const f = await fixture(), url = "/api/staff/tickets/" + f.ticket.id;
    const current = () => db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } });
    await request(app).post(url + "/claim").set(f.staffHeaders).send({ expectedWorkflowVersion: 1 }).expect(200);
    expect((await current()).workflowVersion).toBe(2);
    await request(app).patch(url + "/owner").set(f.staffHeaders).send({ ownerId: f.colleague.id, expectedWorkflowVersion: 2 }).expect(200);
    expect((await current()).workflowVersion).toBe(3);
    const assigned = await current();
    await request(app).patch(url + "/owner").set(f.staffHeaders).send({ ownerId: f.colleague.id, expectedWorkflowVersion: 3 }).expect(200);
    expect(await current()).toEqual(assigned);
    const priority = await request(app).patch(url + "/priority").set(f.adminHeaders).send({ itPriority: "HIGH", expectedWorkflowVersion: 3 }).expect(200);
    expect(priority.headers["cache-control"]).toBe("no-store");
    expect(priority.body).toMatchObject({ workflowVersion: 4, workCycle: 1, resolvedAt: null, requestedPriority: "MEDIUM" });
    const prioritized = await current();
    await request(app).patch(url + "/priority").set(f.adminHeaders).send({ itPriority: "HIGH", expectedWorkflowVersion: 4 }).expect(200);
    expect(await current()).toEqual(prioritized);
    await request(app).post("/api/tickets/" + f.ticket.id + "/resolution-indication").set(f.requesterHeaders).send({ expectedCycle: 1 }).expect(200);
    const indicated = await current(); expect(indicated.workflowVersion).toBe(5);
    await request(app).post("/api/tickets/" + f.ticket.id + "/resolution-indication").set(f.requesterHeaders).send({ expectedCycle: 1 }).expect(200);
    expect(await current()).toEqual(indicated);
    await request(app).patch(url + "/status").set(f.staffHeaders).send({ currentStatus: "OPEN", expectedWorkflowVersion: 5 }).expect(200);
    expect((await current()).workflowVersion).toBe(6);
    const stale = await request(app).post(actionsPath(f.ticket.id)).set(f.staffHeaders).send(createBody()).expect(409);
    expect(stale.body).toMatchObject({ code: "TICKET_VERSION_CONFLICT", currentWorkflowVersion: 6 });
  });
  it("creates one attributed Action/revision and projects only public fields", async () => {
    const f = await fixture(), url = actionsPath(f.ticket.id);
    const r = await request(app).post(url).set(f.staffHeaders).send(createBody({ assigneeId: f.admin.id })).expect(201);
    expect(r.headers.location).toBe(url + "/" + r.body.action.id);
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.body).toMatchObject({ replayed: false, ticket: { id: f.ticket.id, workflowVersion: 2, workCycle: 1 },
      action: { status: "PLANNED", description: "Work", version: 1, cycle: 1,
        createdBy: { id: f.staff.id }, assignee: { id: f.admin.id }, performedBy: null } });
    const a = r.body.action;
    expect(Object.keys(a).sort()).toEqual(["id","ticketId","cycle","status","description","result","assignee","createdBy",
      "performedBy","followUpRequired","followUpNote","attachmentNotes","createdAt","updatedAt","completedAt","cancelledAt","cancellationReason","version"].sort());
    expect(Object.keys(a.createdBy).sort()).toEqual(["id","name","role","isActive"].sort());
    const h = await request(app).get(url + "/" + a.id + "/history").set(f.adminHeaders).expect(200);
    expect(h.body.data).toHaveLength(1);
    expect(h.body.data[0]).toMatchObject({ version: 1, operation: "CREATE", actor: { id: f.staff.id }, changeReason: null,
      snapshot: { id: a.id, createdById: f.staff.id, assigneeId: f.admin.id, performedById: null, createdAt: a.createdAt } });
    expect(JSON.stringify(h.body)).not.toMatch(/createRequestHash|clientRequestId|passwordHash|email|csrfToken/);
    expect((await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } })).currentStatus).toBe("NEW");
  });
  it.each([{ description: "" }, { description: "😀".repeat(4001) }, { followUpRequired: true },
    { followUpRequired: "true" }, { assigneeId: "1" }, { createdById: 1 }, { performedById: 1 },
    { cycle: 2 }, { createdAt: "2026-01-01" }, { unexpected: true }, { expectedWorkflowVersion: 0 },
    { clientRequestId: "bad" }])("rejects invalid creation without writes (%#)", async invalid => {
    const f = await fixture();
    await request(app).post(actionsPath(f.ticket.id)).set(f.staffHeaders).send(createBody(invalid)).expect(400);
    expect(await db.actionTaken.count({ where: { ticketId: f.ticket.id } })).toBe(0);
    expect((await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } })).workflowVersion).toBe(1);
  });
  it("rejects nonexistent, inactive and Requester assignees", async () => {
    const f = await fixture();
    for (const assigneeId of [2147483647, f.inactive.id, f.requester.id]) {
      const r = await request(app).post(actionsPath(f.ticket.id)).set(f.staffHeaders).send(createBody({ assigneeId })).expect(400);
      expect(r.body.code).toBe("INELIGIBLE_ASSIGNEE");
    }
  });
  it("lists all cycles and cancelled items with stable bounded pagination and empty-cycle metadata", async () => {
    const f = await fixture(), url = actionsPath(f.ticket.id), time = new Date("2026-01-01");
    const ids: number[] = [];
    for (let i = 0; i < 12; i++) {
      const a = await db.actionTaken.create({ data: { ticketId: f.ticket.id, cycle: i < 2 ? 1 : 2,
        description: "Row " + i, createdById: f.staff.id, assigneeId: f.staff.id, createdAt: time,
        clientRequestId: createBody().clientRequestId, createRequestHash: "a".repeat(64),
        ...(i === 0 ? { status: "CANCELLED", cancelledAt: time, cancellationReason: "Duplicate" } : {}) } });
      ids.push(a.id);
    }
    const all = await request(app).get(url).set(f.requesterHeaders).expect(200);
    expect(all.body.data.map((a: any) => a.id)).toEqual(ids);
    expect(all.body.pagination).toEqual({ page: 1, pageSize: 20, totalItems: 12, totalPages: 1 });
    const page = await request(app).get(url + "?pageSize=10&page=2").set(f.staffHeaders).expect(200);
    expect(page.body.data.map((a: any) => a.id)).toEqual(ids.slice(10));
    const cycle = await request(app).get(url + "?cycle=1").set(f.staffHeaders).expect(200);
    expect(cycle.body.data.map((a: any) => a.id)).toEqual(ids.slice(0, 2));
    const empty = await request(app).get(url + "?cycle=3&page=4&pageSize=10").set(f.staffHeaders).expect(200);
    expect(empty.body).toEqual({ data: [], pagination: { page: 4, pageSize: 10, totalItems: 0, totalPages: 1 } });
    expect((await request(app).get(url + "?page=9").set(f.staffHeaders).expect(200)).body.data).toEqual([]);
    for (const query of ["cycle=0","cycle=01","cycle[]=1","page=2147483647","pageSize=5","ownerId=me","cycle=1&cycle=2"]) {
      expect((await request(app).get(url + "?" + query).set(f.staffHeaders).expect(400)).body.code).toBe("INVALID_QUERY");
    }
  });
  it("reassigns, starts, completes and corrects with immutable identities and append-only snapshots", async () => {
    const f = await fixture(), url = actionsPath(f.ticket.id);
    let r = (await request(app).post(url).set(f.staffHeaders).send(createBody()).expect(201)).body;
    const item = url + "/" + r.action.id, createdAt = r.action.createdAt;
    const first = (await db.actionTakenRevision.findFirstOrThrow({ where: { actionId: r.action.id } })).snapshot;
    r = (await request(app).patch(item).set(f.adminHeaders).send({ ...versions(r), assigneeId: f.admin.id, description: "Updated" }).expect(200)).body;
    expect((await request(app).post(item + "/transitions").set(f.staffHeaders).send({ ...versions(r), targetStatus: "IN_PROGRESS" }).expect(403)).body.code).toBe("ACTION_ASSIGNEE_REQUIRED");
    r = (await request(app).post(item + "/transitions").set(f.adminHeaders).send({ ...versions(r), targetStatus: "IN_PROGRESS" }).expect(200)).body;
    await request(app).post(item + "/transitions").set(f.adminHeaders).send({ ...versions(r), targetStatus: "COMPLETED", result: "fixed", followUpRequired: true }).expect(400);
    r = (await request(app).post(item + "/transitions").set(f.adminHeaders).send({ ...versions(r), targetStatus: "COMPLETED", result: "fixed", followUpRequired: true, followUpNote: "Monitor" }).expect(200)).body;
    const completedAt = r.action.completedAt;
    await request(app).patch(item).set(f.staffHeaders).send({ ...versions(r), followUpRequired: false }).expect(400);
    await request(app).patch(item).set(f.staffHeaders).send({ ...versions(r), assigneeId: f.admin.id, changeReason: "why" }).expect(400);
    r = (await request(app).patch(item).set(f.staffHeaders).send({ ...versions(r), followUpRequired: false, changeReason: "Confirmed stable" }).expect(200)).body;
    expect(r.action).toMatchObject({ createdAt, completedAt, createdBy: { id: f.staff.id }, performedBy: { id: f.admin.id }, followUpNote: "Monitor", version: 5 });
    const noop = await request(app).patch(item).set(f.adminHeaders).send({ ...versions(r), description: " Updated " }).expect(200);
    expect(noop.body).toEqual(r);
    const history = (await request(app).get(item + "/history").set(f.staffHeaders).expect(200)).body;
    expect(history.data.map((v: any) => v.operation)).toEqual(["CREATE","REASSIGN","START","COMPLETE","EDIT"]);
    expect(history.data.map((v: any) => v.version)).toEqual([1,2,3,4,5]);
    expect(history.data[4].changeReason).toBe("Confirmed stable");
    expect(history.data[0].snapshot).toEqual(first);
    await request(app).post(item + "/transitions").set(f.adminHeaders).send({ ...versions(r), targetStatus: "CANCELLED", confirmed: true, reason: "why" }).expect(409);
  });
  it("cancels without losing content and rejects subsequent writes or old/terminal parent writes", async () => {
    const f = await fixture(), url = actionsPath(f.ticket.id);
    let r = (await request(app).post(url).set(f.staffHeaders).send(createBody({ result: "Partial" })).expect(201)).body;
    const item = url + "/" + r.action.id;
    r = (await request(app).post(item + "/transitions").set(f.adminHeaders).send({ ...versions(r), targetStatus: "CANCELLED", confirmed: true, reason: " Duplicate " }).expect(200)).body;
    expect(r.action).toMatchObject({ result: "Partial", cancellationReason: "Duplicate", performedBy: null, completedAt: null });
    expect((await request(app).patch(item).set(f.staffHeaders).send({ ...versions(r), description: "new" }).expect(409)).body.code).toBe("ACTION_READ_ONLY");
    await db.ticket.update({ where: { id: f.ticket.id }, data: { workCycle: 2 } });
    expect((await request(app).patch(item).set(f.staffHeaders).send({ ...versions(r), description: "new" }).expect(409)).body.code).toBe("TICKET_CYCLE_CONFLICT");
    await db.ticket.update({ where: { id: f.ticket.id }, data: { currentStatus: "RESOLVED" } });
    expect((await request(app).post(url).set(f.staffHeaders).send(createBody({ expectedWorkflowVersion: r.ticket.workflowVersion })).expect(409)).body.code).toBe("TICKET_NOT_ACTIVE");
  });
  it("replays normalized creation before stale/terminal/cycle/assignee guards, with current metadata", async () => {
    const f = await fixture(), url = actionsPath(f.ticket.id), body = createBody({ assigneeId: f.colleague.id });
    const first = (await request(app).post(url).set(f.staffHeaders).send(body).expect(201)).body;
    await db.ticket.update({ where: { id: f.ticket.id }, data: { currentStatus: "CLOSED", workCycle: 2, workflowVersion: 8 } });
    await db.user.update({ where: { id: f.colleague.id }, data: { isActive: false } });
    const replay = (await request(app).post(url).set(f.staffHeaders).send({ ...body, description: "Work", expectedWorkflowVersion: 99 }).expect(200)).body;
    expect(replay).toMatchObject({ replayed: true, action: { id: first.action.id, assignee: { isActive: false } }, ticket: { workflowVersion: 8, workCycle: 2 } });
    expect(await db.actionTakenRevision.count({ where: { actionId: first.action.id } })).toBe(1);
    expect((await request(app).post(url).set(f.staffHeaders).send({ ...body, result: "changed" }).expect(409)).body.code).toBe("IDEMPOTENCY_KEY_REUSED");
    const other = await f.makeTicket();
    expect((await request(app).post(actionsPath(other.id)).set(f.staffHeaders).send(body).expect(409)).body.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });
  it("returns authorized current versions, checking parent before action and before no-op", async () => {
    const f = await fixture(), url = actionsPath(f.ticket.id);
    const r = (await request(app).post(url).set(f.staffHeaders).send(createBody()).expect(201)).body;
    const item = url + "/" + r.action.id;
    const stale = await request(app).patch(item).set(f.staffHeaders).send({ expectedVersion: 99, expectedWorkflowVersion: 1, description: "Work" }).expect(409);
    expect(stale.body).toMatchObject({ code: "TICKET_VERSION_CONFLICT", currentWorkflowVersion: 2, currentActionVersion: 1 });
    expect((await request(app).patch(item).set(f.staffHeaders).send({ expectedVersion: 99, expectedWorkflowVersion: 2, description: "Work" }).expect(409)).body.code).toBe("ACTION_VERSION_CONFLICT");
  });
  it("lists only my outstanding current-cycle Actions on active parents, with bounded summaries", async () => {
    const f = await fixture(), url = actionsPath(f.ticket.id);
    const r = (await request(app).post(url).set(f.staffHeaders).send(createBody({ description: "😀".repeat(201) })).expect(201)).body;
    const endpoint = "/api/staff/actions?assigneeId=me&state=outstanding";
    const list = (await request(app).get(endpoint).set(f.staffHeaders).expect(200)).body;
    expect(list.pagination.totalItems).toBe(1);
    expect(list.data[0]).toEqual({ id: r.action.id, ticketId: f.ticket.id, cycle: 1, status: "PLANNED",
      descriptionExcerpt: "😀".repeat(200), createdAt: r.action.createdAt,
      ticket: { id: f.ticket.id, ticketNumber: f.ticket.ticketNumber, summary: "Actions", currentStatus: "NEW" } });
    expect((await request(app).get(endpoint).set(f.adminHeaders).expect(200)).body.data).toEqual([]);
    await db.ticket.update({ where: { id: f.ticket.id }, data: { workCycle: 2 } });
    expect((await request(app).get(endpoint).set(f.staffHeaders).expect(200)).body.pagination.totalItems).toBe(0);
    await db.ticket.update({ where: { id: f.ticket.id }, data: { workCycle: 1, currentStatus: "CLOSED" } });
    expect((await request(app).get(endpoint).set(f.staffHeaders).expect(200)).body.data).toEqual([]);
    for (const q of ["", "?assigneeId=1&state=outstanding", "?assigneeId=me&state=completed", "?assigneeId=me&state=outstanding&cycle=1"]) {
      await request(app).get("/api/staff/actions" + q).set(f.staffHeaders).expect(400);
    }
  });
});
