import { afterEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import { Prisma, type PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";
import * as database from "../../src/prisma.js";
import { db, fixture, actionsPath, createBody, versions, completed } from "./api-fixtures.js";
import { requesterHeaders } from "../lab-03/legacy-session.js";

afterEach(() => vi.restoreAllMocks());
function barrier() {
  let release!: () => void;
  const reached = new Promise<void>(resolve => { release = resolve; });
  return { reached, release };
}
function useClient(client: unknown) { vi.spyOn(database, "getPrisma").mockReturnValue(client as PrismaClient); }
async function untilBlocked(kind: "advisory" | "transactionid") {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(
      "SELECT count(*) FROM pg_locks WHERE NOT granted AND locktype=$1 AND pid IN (SELECT pid FROM pg_stat_activity WHERE datname=current_database())", kind);
    if (Number(rows[0].count)) return;
  }
  throw new Error("Expected database lock wait was not observed.");
}

// The first request is paused inside its transaction; observe PostgreSQL actually
// blocking the competitor before release. No race depends on scheduler timing.
async function orderedRace(reached: ReturnType<typeof barrier>, resume: ReturnType<typeof barrier>,
  first: Promise<any>, startSecond: () => Promise<any>, kind: "advisory" | "transactionid" = "transactionid") {
  let second: Promise<any> | undefined;
  try {
    await Promise.race([reached.reached, first.then(() => { throw new Error("Missed barrier"); })]);
    second = startSecond(); await untilBlocked(kind); resume.release();
    return await Promise.all([first, second]);
  } finally { resume.release(); await first; await second; }
}

describe("L4-CON-02/03/04/05/06 Ticket workflow transactions", () => {
  it.each(["claim", "owner", "priority", "status"])("rechecks the live actor on a waiting Ticket %s mutation", async route => {
    const f = await fixture(), reached = barrier(), resume = barrier();
    const before = await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } });
    useClient(db.$extends({ query: { user: { async update({ args, query }) {
      if (args.where.id === f.staff.id) { reached.release(); await resume.reached; }
      return query(args);
    } } } }));
    const deactivate = request(app).patch(`/api/admin/users/${f.staff.id}`).set(f.adminHeaders).send({ isActive: false }).then(r => r);
    const body = route === "owner" ? { ownerId: f.colleague.id } : route === "priority" ? { itPriority: "HIGH" } : route === "status" ? { currentStatus: "OPEN" } : {};
    const [first, second] = await orderedRace(reached, resume, deactivate, () => request(app)[route === "claim" ? "post" : "patch"](`/api/staff/tickets/${f.ticket.id}/${route}`)
      .set(f.staffHeaders).send({ ...body, expectedWorkflowVersion: 1 }).then(r => r), "advisory");
    expect(first.status).toBe(200); expect(second.status).toBe(401); expect(second.body.code).toBe("UNAUTHENTICATED");
    expect(await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } })).toEqual(before);
  });
  it.each([false, true])("serializes Action creation versus resolution (resolve first=%s)", async resolveFirst => {
    const f = await fixture(); await completed(f);
    await db.ticket.update({ where: { id: f.ticket.id }, data: { currentStatus: "IN_PROGRESS", ownerId: f.staff.id } });
    const reached = barrier(), resume = barrier();
    useClient(db.$extends({ query: {
      ticket: { async update({ args, query }) {
        if (resolveFirst && args.where.id === f.ticket.id && args.data.currentStatus === "RESOLVED") { reached.release(); await resume.reached; }
        return query(args);
      } },
      actionTaken: { async create({ args, query }) {
        if (!resolveFirst && args.data.ticketId === f.ticket.id) { reached.release(); await resume.reached; }
        return query(args);
      } },
    } }));
    const resolve = (version = 4) => request(app).patch(`/api/staff/tickets/${f.ticket.id}/status`).set(f.staffHeaders)
      .send({ currentStatus: "RESOLVED", expectedWorkflowVersion: version, confirmed: true }).then(r => r);
    const create = (version = 4) => request(app).post(actionsPath(f.ticket.id)).set(f.colleagueHeaders)
      .send(createBody({ expectedWorkflowVersion: version })).then(r => r);
    const [first, second] = await orderedRace(reached, resume, resolveFirst ? resolve() : create(), () => resolveFirst ? create() : resolve());
    expect(first.status).toBe(resolveFirst ? 200 : 201);
    expect(second.status).toBe(409); expect(second.body.code).toBe("TICKET_VERSION_CONFLICT");
    const retry = resolveFirst ? await create(5) : await resolve(5);
    expect(retry.status).toBe(409); expect(retry.body.code).toBe(resolveFirst ? "TICKET_NOT_ACTIVE" : "RESOLUTION_BLOCKED");
    const parent = await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } });
    expect(parent.currentStatus).toBe(resolveFirst ? "RESOLVED" : "IN_PROGRESS"); expect(parent.workflowVersion).toBe(5);
    expect(await db.actionTaken.count({ where: { ticketId: f.ticket.id, status: "PLANNED" } })).toBe(resolveFirst ? 0 : 1);
  });
  it.each([false, true])("serializes follow-up addition versus resolution (resolve first=%s)", async resolveFirst => {
    const f = await fixture(), a = await completed(f);
    await db.ticket.update({ where: { id: f.ticket.id }, data: { currentStatus: "IN_PROGRESS", ownerId: f.staff.id } });
    const reached = barrier(), resume = barrier();
    useClient(db.$extends({ query: {
      ticket: { async update({ args, query }) {
        if (resolveFirst && args.where.id === f.ticket.id && args.data.currentStatus === "RESOLVED") { reached.release(); await resume.reached; }
        return query(args);
      } },
      actionTaken: { async update({ args, query }) {
        if (!resolveFirst && args.where.id === a.action.id) { reached.release(); await resume.reached; }
        return query(args);
      } },
    } }));
    const resolve = (version = 4) => request(app).patch(`/api/staff/tickets/${f.ticket.id}/status`).set(f.staffHeaders)
      .send({ currentStatus: "RESOLVED", expectedWorkflowVersion: version, confirmed: true }).then(r => r);
    const edit = (version = 4) => request(app).patch(actionsPath(f.ticket.id) + "/" + a.action.id).set(f.colleagueHeaders)
      .send({ ...versions(a), expectedWorkflowVersion: version, followUpRequired: true, followUpNote: "Check", changeReason: "New information" }).then(r => r);
    const [first, second] = await orderedRace(reached, resume, resolveFirst ? resolve() : edit(), () => resolveFirst ? edit() : resolve());
    expect(first.status).toBe(200); expect(second.body.code).toBe("TICKET_VERSION_CONFLICT");
    const retry = resolveFirst ? await edit(5) : await resolve(5);
    expect(retry.status).toBe(409); expect(retry.body.code).toBe(resolveFirst ? "TICKET_NOT_ACTIVE" : "RESOLUTION_BLOCKED");
    if (!resolveFirst) expect(retry.body.details.outstandingFollowUps).toBe(1);
    expect(await db.actionTakenRevision.count({ where: { actionId: a.action.id } })).toBe(resolveFirst ? 3 : 4);
  });
  it.each([false, true])("serializes follow-up clearance versus resolution (clear first=%s)", async clearFirst => {
    const f = await fixture(), a = await completed(f, true);
    await db.ticket.update({ where: { id: f.ticket.id }, data: { currentStatus: "IN_PROGRESS", ownerId: f.staff.id } });
    const reached = barrier(), resume = barrier();
    useClient(db.$extends({ query: {
      // The status request reads its owner under the parent lock before evaluating the gate.
      user: { async findUnique({ args, query }) {
        if (!clearFirst && args.where.id === f.staff.id && args.select?.isActive && args.select?.role) { reached.release(); await resume.reached; }
        return query(args);
      } },
      actionTaken: { async update({ args, query }) {
        if (clearFirst && args.where.id === a.action.id) { reached.release(); await resume.reached; }
        return query(args);
      } },
    } }));
    const resolve = (version = 4) => request(app).patch(`/api/staff/tickets/${f.ticket.id}/status`).set(f.staffHeaders)
      .send({ currentStatus: "RESOLVED", expectedWorkflowVersion: version, confirmed: true }).then(r => r);
    const clear = () => request(app).patch(actionsPath(f.ticket.id) + "/" + a.action.id).set(f.colleagueHeaders)
      .send({ ...versions(a), followUpRequired: false, changeReason: "Follow-up finished" }).then(r => r);
    const [first, second] = await orderedRace(reached, resume, clearFirst ? clear() : resolve(), () => clearFirst ? resolve() : clear());
    expect(first.status).toBe(clearFirst ? 200 : 409);
    expect(second.status).toBe(clearFirst ? 409 : 200);
    expect((clearFirst ? second : first).body.code).toBe(clearFirst ? "TICKET_VERSION_CONFLICT" : "RESOLUTION_BLOCKED");
    expect((await resolve(5)).status).toBe(200);
    expect((await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } })).workflowVersion).toBe(6);
  });
  it("commits only one competing status transition and public reason", async () => {
    const f = await fixture(), reached = barrier(), resume = barrier();
    useClient(db.$extends({ query: { publicComment: { async create({ args, query }) {
      if (args.data.ticketId === f.ticket.id) { const row = await query(args); reached.release(); await resume.reached; return row; }
      return query(args);
    } } } }));
    const cancel = request(app).patch(`/api/staff/tickets/${f.ticket.id}/status`).set(f.staffHeaders)
      .send({ currentStatus: "CANCELLED", expectedWorkflowVersion: 1, confirmed: true, reason: "Duplicate" }).then(r => r);
    const [first, second] = await orderedRace(reached, resume, cancel, () => request(app).patch(`/api/staff/tickets/${f.ticket.id}/status`)
      .set(f.colleagueHeaders).send({ currentStatus: "OPEN", expectedWorkflowVersion: 1 }).then(r => r));
    expect(first.status).toBe(200); expect(second.body.code).toBe("TICKET_VERSION_CONFLICT");
    expect(await db.publicComment.count({ where: { ticketId: f.ticket.id } })).toBe(1);
    expect((await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } })).workflowVersion).toBe(2);
  });
  it.each([false, true])("coordinates owner changes with deactivation (deactivate first=%s)", async deactivateFirst => {
    const f = await fixture(), extra = await f.makeTicket(), reached = barrier(), resume = barrier();
    await db.ticket.updateMany({ where: { id: { in: [f.ticket.id, extra.id] } }, data: { ownerId: f.colleague.id } });
    useClient(db.$extends({ query: {
      user: { async update({ args, query }) {
        if (deactivateFirst && args.where.id === f.colleague.id) { reached.release(); await resume.reached; }
        return query(args);
      } },
      ticket: { async update({ args, query }) {
        if (!deactivateFirst && args.where.id === f.ticket.id) { reached.release(); await resume.reached; }
        return query(args);
      } },
    } }));
    const deactivate = () => request(app).patch(`/api/admin/users/${f.colleague.id}`).set(f.adminHeaders).send({ isActive: false }).then(r => r);
    const owner = () => request(app).patch(`/api/staff/tickets/${f.ticket.id}/owner`).set(f.staffHeaders)
      .send({ ownerId: f.staff.id, expectedWorkflowVersion: 1 }).then(r => r);
    const [first, second] = await orderedRace(reached, resume, deactivateFirst ? deactivate() : owner(), () => deactivateFirst ? owner() : deactivate(), "advisory");
    expect(first.status).toBe(200); expect(second.status).toBe(deactivateFirst ? 409 : 200);
    if (deactivateFirst) expect(second.body.code).toBe("TICKET_VERSION_CONFLICT");
    expect(await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } })).toMatchObject({ ownerId: deactivateFirst ? null : f.staff.id, workflowVersion: 2 });
    expect(await db.ticket.findUniqueOrThrow({ where: { id: extra.id } })).toMatchObject({ ownerId: null, workflowVersion: 2 });
  });
  it.each([false, true])("coordinates resolution with owner demotion (demote first=%s)", async demoteFirst => {
    const f = await fixture(), a = await completed(f), reached = barrier(), resume = barrier();
    await db.ticket.update({ where: { id: f.ticket.id }, data: { ownerId: f.colleague.id, currentStatus: "IN_PROGRESS" } });
    useClient(db.$extends({ query: {
      user: { async update({ args, query }) {
        if (demoteFirst && args.where.id === f.colleague.id) { reached.release(); await resume.reached; }
        return query(args);
      } },
      ticket: { async update({ args, query }) {
        if (!demoteFirst && args.where.id === f.ticket.id && args.data.currentStatus === "RESOLVED") { reached.release(); await resume.reached; }
        return query(args);
      } },
    } }));
    const demote = () => request(app).patch(`/api/admin/users/${f.colleague.id}`).set(f.adminHeaders).send({ role: "REQUESTER" }).then(r => r);
    const resolve = () => request(app).patch(`/api/staff/tickets/${f.ticket.id}/status`).set(f.staffHeaders)
      .send({ currentStatus: "RESOLVED", expectedWorkflowVersion: 4, confirmed: true }).then(r => r);
    const [first, second] = await orderedRace(reached, resume, demoteFirst ? demote() : resolve(), () => demoteFirst ? resolve() : demote(), "advisory");
    expect(first.status).toBe(200); expect(second.status).toBe(demoteFirst ? 409 : 200);
    if (demoteFirst) expect(second.body.code).toBe("TICKET_VERSION_CONFLICT");
    expect(await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } })).toMatchObject({ ownerId: null,
      workflowVersion: demoteFirst ? 5 : 6, currentStatus: demoteFirst ? "IN_PROGRESS" : "RESOLVED" });
    expect((await db.actionTaken.findUniqueOrThrow({ where: { id: a.action.id } })).performedById).toBe(f.staff.id);
  });
  it.each([false, true])("serializes Requester indication with resolution (indicate first=%s)", async indicateFirst => {
    const f = await fixture(); await completed(f);
    await db.ticket.update({ where: { id: f.ticket.id }, data: { currentStatus: "IN_PROGRESS", ownerId: f.staff.id } });
    const reached = barrier(), resume = barrier();
    useClient(db.$extends({ query: { ticket: { async update({ args, query }) {
      if (args.where.id === f.ticket.id && (indicateFirst ? args.data.resolutionSuggestedAt instanceof Date : args.data.currentStatus === "RESOLVED")) {
        reached.release(); await resume.reached;
      }
      return query(args);
    } } } }));
    const indicate = () => request(app).post(`/api/tickets/${f.ticket.id}/resolution-indication`).set(f.requesterHeaders).send({ expectedCycle: 1 }).then(r => r);
    const resolve = () => request(app).patch(`/api/staff/tickets/${f.ticket.id}/status`).set(f.staffHeaders)
      .send({ currentStatus: "RESOLVED", expectedWorkflowVersion: 4, confirmed: true }).then(r => r);
    const [first, second] = await orderedRace(reached, resume, indicateFirst ? indicate() : resolve(), () => indicateFirst ? resolve() : indicate());
    expect(first.status).toBe(200); expect(second.status).toBe(409);
    expect(second.body.code).toBe(indicateFirst ? "TICKET_VERSION_CONFLICT" : "TICKET_NOT_ACTIVE");
    const row = await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } });
    expect(row.workflowVersion).toBe(5); expect(row.currentStatus).toBe(indicateFirst ? "IN_PROGRESS" : "RESOLVED");
    expect(!!row.resolutionSuggestedAt).toBe(indicateFirst);
  });
  it("rejects a waiting prior-cycle indication after reopen and deduplicates new-cycle indications", async () => {
    const f = await fixture(), reached = barrier(), resume = barrier();
    await db.ticket.update({ where: { id: f.ticket.id }, data: { currentStatus: "RESOLVED" } });
    useClient(db.$extends({ query: { ticket: { async update({ args, query }) {
      if (args.where.id === f.ticket.id && args.data.currentStatus === "REOPENED") { reached.release(); await resume.reached; }
      return query(args);
    } } } }));
    const reopen = request(app).patch(`/api/staff/tickets/${f.ticket.id}/status`).set(f.staffHeaders)
      .send({ currentStatus: "REOPENED", expectedWorkflowVersion: 1, confirmed: true, reason: "Again" }).then(r => r);
    const [first, second] = await orderedRace(reached, resume, reopen, () => request(app).post(`/api/tickets/${f.ticket.id}/resolution-indication`)
      .set(f.requesterHeaders).send({ expectedCycle: 1 }).then(r => r));
    expect(first.status).toBe(200); expect(second.body).toMatchObject({ code: "TICKET_CYCLE_CONFLICT", currentCycle: 2 });
    const sessions = [f.requesterHeaders, await requesterHeaders(f.requester.id)];
    const both = await Promise.all(sessions.map(headers => request(app).post(`/api/tickets/${f.ticket.id}/resolution-indication`).set(headers).send({ expectedCycle: 2 })));
    expect(both.map(r => r.status)).toEqual([200,200]); expect(both[0].body).toEqual(both[1].body);
    expect(both[0].body).toMatchObject({ currentStatus: "REOPENED", workflowVersion: 3, workCycle: 2 });
  });
  it("rolls back public reason, status, cycle and advisory fields on a failure after writes", async () => {
    const f = await fixture();
    await db.ticket.update({ where: { id: f.ticket.id }, data: { currentStatus: "RESOLVED", resolutionSuggestedAt: new Date(), resolutionSuggestedById: f.requester.id } });
    const before = await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } });
    useClient(db.$extends({ query: { ticket: { async update({ args, query }) {
      const row = await query(args); if (args.where.id === f.ticket.id) throw new Error("private SQL details"); return row;
    } } } }));
    const r = await request(app).patch(`/api/staff/tickets/${f.ticket.id}/status`).set(f.staffHeaders)
      .send({ currentStatus: "REOPENED", expectedWorkflowVersion: 1, confirmed: true, reason: "Again" }).expect(500);
    expect(r.body).toEqual({ code: "INTERNAL_ERROR", error: "Unable to complete the request." });
    expect(await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } })).toEqual(before);
    expect(await db.publicComment.count({ where: { ticketId: f.ticket.id } })).toBe(0);
  });
});
describe("L4-CON-01/02/04/06 Action transactions", () => {
  it("deduplicates simultaneous creation and detects cross-parent UUID reuse after rollback", async () => {
    const f = await fixture(), url = actionsPath(f.ticket.id), body = createBody();
    const results = await Promise.all([1,2].map(() => request(app).post(url).set(f.staffHeaders).send(body)));
    expect(results.map(r => r.status).sort()).toEqual([200,201]);
    expect(results[0].body.action.id).toBe(results[1].body.action.id);
    expect(await db.actionTakenRevision.count({ where: { action: { ticketId: f.ticket.id } } })).toBe(1);
    const second = await f.makeTicket(), third = await f.makeTicket(), shared = createBody();
    const bothInserting = barrier(); let arrivals = 0, collisions = 0;
    useClient(db.$extends({ query: { actionTaken: { async create({ args, query }) {
      if (args.data.clientRequestId === shared.clientRequestId) {
        if (++arrivals === 2) bothInserting.release();
        await bothInserting.reached;
      }
      try { return await query(args); }
      catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") collisions++;
        throw error;
      }
    } } } }));
    // Separate live sessions for the same creator avoid serializing at auth.load's
    // session touch, forcing both parents to reach the real unique-key race.
    const sessions = [await requesterHeaders(f.staff.id), await requesterHeaders(f.staff.id)];
    const cross = await Promise.all([second,third].map((t,i) => request(app).post(actionsPath(t.id)).set(sessions[i]).send(shared)));
    expect(arrivals).toBe(2); expect(collisions).toBe(1);
    expect(cross.map(r => r.status).sort()).toEqual([201,409]);
    expect(cross.find(r => r.status === 409)!.body.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(await db.actionTaken.count({ where: { ticketId: { in: [second.id,third.id] } } })).toBe(1);
  });
  it("serializes two edits on the parent and returns stale intent without another revision", async () => {
    const f = await fixture(), url = actionsPath(f.ticket.id);
    const a = (await request(app).post(url).set(f.staffHeaders).send(createBody()).expect(201)).body;
    const reached = barrier(), resume = barrier();
    const client = db.$extends({ query: { actionTaken: { async update({ args, query }) {
      if (args.where.id === a.action.id && args.data.description === "First") { reached.release(); await resume.reached; }
      return query(args);
    } } } });
    useClient(client);
    const first = request(app).patch(url + "/" + a.action.id).set(f.staffHeaders).send({ ...versions(a), description: "First" }).then(r => r);
    let second: Promise<any> | undefined;
    try {
      await Promise.race([reached.reached, first.then(() => { throw new Error("Missed barrier"); })]);
      second = request(app).patch(url + "/" + a.action.id).set(f.colleagueHeaders).send({ ...versions(a), description: "Second" }).then(r => r);
      await untilBlocked("transactionid");
      resume.release();
      expect((await first).status).toBe(200);
      const lost = await second; expect(lost.status).toBe(409); expect(lost.body.code).toBe("TICKET_VERSION_CONFLICT");
      expect(await db.actionTakenRevision.count({ where: { actionId: a.action.id } })).toBe(2);
    } finally { resume.release(); await first; await second; }
  });
  it.each([false,true])("coordinates assignment with account deactivation (deactivation first=%s)", async deactivateFirst => {
    const f = await fixture(), url = actionsPath(f.ticket.id), reached = barrier(), resume = barrier();
    await db.ticket.update({ where: { id: f.ticket.id }, data: { ownerId: f.colleague.id } });
    const client = db.$extends({ query: {
      user: { async update({ args, query }) {
        if (deactivateFirst && args.where.id === f.colleague.id && args.data.isActive === false) { reached.release(); await resume.reached; }
        return query(args);
      } },
      actionTaken: { async create({ args, query }) {
        if (!deactivateFirst && args.data.ticketId === f.ticket.id) { reached.release(); await resume.reached; }
        return query(args);
      } },
    } });
    useClient(client);
    const create = () => request(app).post(url).set(f.staffHeaders).send(createBody({ assigneeId: f.colleague.id })).then(r => r);
    const deactivate = () => request(app).patch("/api/admin/users/" + f.colleague.id).set(f.adminHeaders).send({ isActive: false }).then(r => r);
    const first = deactivateFirst ? deactivate() : create();
    let second: Promise<any> | undefined;
    try {
      await Promise.race([reached.reached, first.then(() => { throw new Error("Missed barrier"); })]);
      second = deactivateFirst ? create() : deactivate();
      await untilBlocked("advisory"); resume.release();
      const [a,b] = await Promise.all([first,second]);
      expect(deactivateFirst ? a.status : b.status).toBe(200);
      if (deactivateFirst) { expect(b.status).toBe(409); expect(b.body.code).toBe("TICKET_VERSION_CONFLICT"); }
      else {
        expect(a.status).toBe(201);
        expect((await db.actionTaken.findUniqueOrThrow({ where: { id: a.body.action.id } })).assigneeId).toBe(f.colleague.id);
      }
      const parent = await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } });
      expect(parent.ownerId).toBeNull(); expect(parent.workflowVersion).toBe(deactivateFirst ? 2 : 3);
    } finally { resume.release(); await first; await second; }
  });
  it.each(["create", "start", "complete"])("rechecks actor/session before %s after waiting for account deactivation", async operation => {
    const f = await fixture(), reached = barrier(), resume = barrier();
    const url = actionsPath(f.ticket.id);
    let action: any;
    if (operation !== "create") {
      action = (await request(app).post(url).set(f.staffHeaders).send(createBody()).expect(201)).body;
      if (operation === "complete") action = (await request(app).post(url + "/" + action.action.id + "/transitions")
        .set(f.staffHeaders).send({ ...versions(action), targetStatus: "IN_PROGRESS" }).expect(200)).body;
    }
    const before = await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } });
    const client = db.$extends({ query: { user: { async update({ args, query }) {
      if (args.where.id === f.staff.id && args.data.isActive === false) { reached.release(); await resume.reached; }
      return query(args);
    } } } }); useClient(client);
    const deactivate = request(app).patch("/api/admin/users/" + f.staff.id).set(f.adminHeaders).send({ isActive: false }).then(r => r);
    let create: Promise<any> | undefined;
    try {
      await Promise.race([reached.reached, deactivate.then(() => { throw new Error("Missed barrier"); })]);
      create = operation === "create"
        ? request(app).post(url).set(f.staffHeaders).send(createBody()).then(r => r)
        : request(app).post(url + "/" + action.action.id + "/transitions").set(f.staffHeaders)
          .send({ ...versions(action), targetStatus: operation === "start" ? "IN_PROGRESS" : "COMPLETED",
            ...(operation === "complete" ? { result: "Fixed", followUpRequired: false } : {}) }).then(r => r);
      await untilBlocked("advisory"); resume.release();
      expect((await deactivate).status).toBe(200);
      expect((await create).status).toBe(401);
      expect(await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } })).toEqual(before);
      if (action) {
        expect(await db.actionTaken.findUniqueOrThrow({ where: { id: action.action.id } })).toMatchObject({
          status: action.action.status, version: action.action.version, performedById: null,
        });
        expect(await db.actionTakenRevision.count({ where: { actionId: action.action.id } })).toBe(action.action.version);
      } else expect(await db.actionTaken.count({ where: { ticketId: f.ticket.id } })).toBe(0);
    } finally { resume.release(); await deactivate; await create; }
  });
  it("coordinates existing Ticket status writes so waiting Actions see the committed terminal state", async () => {
    const f = await fixture(), reached = barrier(), resume = barrier();
    const client = db.$extends({ query: { ticket: { async update({ args, query }) {
      if (args.where.id === f.ticket.id && args.data.currentStatus === "CANCELLED") { reached.release(); await resume.reached; }
      return query(args);
    } } } }); useClient(client);
    const cancel = request(app).patch("/api/staff/tickets/" + f.ticket.id + "/status").set(f.staffHeaders)
      .send({ currentStatus: "CANCELLED", expectedWorkflowVersion: 1, confirmed: true, reason: "Duplicate" }).then(r => r);
    let create: Promise<any> | undefined;
    try {
      await Promise.race([reached.reached, cancel.then(() => { throw new Error("Missed barrier"); })]);
      create = request(app).post(actionsPath(f.ticket.id)).set(f.colleagueHeaders).send(createBody({ expectedWorkflowVersion: 2 })).then(r => r);
      await untilBlocked("transactionid"); resume.release();
      expect((await cancel).status).toBe(200);
      const denied = await create; expect(denied.status).toBe(409); expect(denied.body.code).toBe("TICKET_NOT_ACTIVE");
      expect(await db.actionTaken.count({ where: { ticketId: f.ticket.id } })).toBe(0);
    } finally { resume.release(); await cancel; await create; }
  });
  it("rolls back Action, revision and parent on a failure after all writes, with a safe error", async () => {
    const f = await fixture(), before = await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } });
    const client = db.$extends({ query: { ticket: { async update({ args, query }) {
      const result = await query(args);
      if (args.where.id === f.ticket.id) throw new Error("SQL credential SECRET fixture");
      return result;
    } } } }); useClient(client);
    const failure = await request(app).post(actionsPath(f.ticket.id)).set(f.staffHeaders).send(createBody()).expect(500);
    expect(failure.body).toEqual({ error: "Unable to complete the request.", code: "INTERNAL_ERROR" });
    expect(await db.actionTaken.count({ where: { ticketId: f.ticket.id } })).toBe(0);
    expect(await db.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } })).toEqual(before);
  });
  it.each([2,3])("retries only rolled-back concurrency failures at most twice (%s failures)", async failures => {
    const f = await fixture(); let attempts = 0;
    const client = db.$extends({ query: { actionTakenRevision: { async create({ args, query }) {
      const result = await query(args);
      if (++attempts <= failures) throw new Prisma.PrismaClientKnownRequestError("Injected rolled-back conflict", { code: "P2034", clientVersion: "5.22.0" });
      return result;
    } } } }); useClient(client);
    const r = await request(app).post(actionsPath(f.ticket.id)).set(f.staffHeaders).send(createBody());
    expect(attempts).toBe(3);
    expect(r.status).toBe(failures === 2 ? 201 : 409);
    if (failures === 3) expect(r.body.code).toBe("CONCURRENT_UPDATE");
    expect(await db.actionTaken.count({ where: { ticketId: f.ticket.id } })).toBe(failures === 2 ? 1 : 0);
    expect(await db.actionTakenRevision.count({ where: { action: { ticketId: f.ticket.id } } })).toBe(failures === 2 ? 1 : 0);
  });
});
