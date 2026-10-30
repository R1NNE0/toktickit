import request from "supertest";
import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { dashboardClock } from "../../src/staffDashboard.js";
import { fixture, db } from "./api-fixtures.js";

afterEach(() => vi.restoreAllMocks());
it("authorizes operational roles, rejects ownership/window overrides, and denies Requesters", async () => {
  const f = await fixture();
  await request(app).get("/api/dashboard/staff").expect(401);
  await request(app).get("/api/dashboard/staff").set(f.requesterHeaders).expect(403);
  for (const headers of [f.staffHeaders, f.adminHeaders]) {
    const r = await request(app).get("/api/dashboard/staff").set(headers).expect(200);
    expect(r.headers["cache-control"]).toBe("no-store"); expect(r.body.metrics.myOutstandingActions).toBe(0);
    await request(app).get("/api/dashboard/staff?ownerId=me").set(headers).expect(400);
    await request(app).get("/api/dashboard/staff").set(headers).send({ from: "2026-01-01" }).expect(400);
  }
});
it("counts Tickets once, Actions separately, and excludes former cycles and terminal parents", async () => {
  const f = await fixture();
  await db.ticket.update({ where: { id: f.ticket.id }, data: { ownerId: f.staff.id, currentStatus: "REOPENED", workCycle: 2 } });
  const terminal = await f.makeTicket(); await db.ticket.update({ where: { id: terminal.id }, data: { currentStatus: "CLOSED" } });
  const create = (ticketId: number, cycle: number, assigneeId: number) => db.actionTaken.create({ data: {
    ticketId, cycle, description: "😀".repeat(210), assigneeId, createdById: f.admin.id,
    clientRequestId: randomUUID(), createRequestHash: "0".repeat(64) } });
  await create(f.ticket.id, 2, f.staff.id); await create(f.ticket.id, 2, f.staff.id);
  await create(f.ticket.id, 1, f.staff.id); await create(terminal.id, 1, f.staff.id); await create(f.ticket.id, 2, f.colleague.id);
  const { body } = await request(app).get("/api/dashboard/staff").set(f.staffHeaders).expect(200);
  expect(body.metrics.myActiveTickets).toBe(1); expect(body.metrics.myOutstandingActions).toBe(2);
  expect(body.myActions.items).toHaveLength(2); expect([...body.myActions.items[0].descriptionExcerpt]).toHaveLength(200);
  expect(body.myActions.items[0]).not.toHaveProperty("createRequestHash");
  const admin = await request(app).get("/api/dashboard/staff").set(f.adminHeaders).expect(200);
  expect(admin.body.metrics.myOutstandingActions).toBe(0);
});
it("uses exact UTC half-open boundaries and bounded stable previews", async () => {
  const f = await fixture(), to = new Date("2030-01-08T00:00:00Z"), from = new Date("2030-01-01T00:00:00Z");
  vi.spyOn(dashboardClock, "now").mockResolvedValue(to);
  const ids: number[] = [];
  for (const updatedAt of [from, new Date(+from - 1), new Date(+to - 1), to, new Date(+to + 1)]) {
    const t = await f.makeTicket(); await db.ticket.update({ where: { id: t.id }, data: { updatedAt } });
    if (+updatedAt >= +from && +updatedAt < +to) ids.push(t.id);
  }
  const { body } = await request(app).get("/api/dashboard/staff").set(f.staffHeaders).expect(200);
  expect(body.recentWindow).toEqual({ from: from.toISOString(), to: to.toISOString() });
  expect(body.recentTickets.map((t: any) => t.id)).toEqual(ids.reverse());
  expect(body.recentTickets.length).toBeLessThanOrEqual(5);
  const queue = await request(app).get("/api/staff/tickets").query(body.drilldowns.recentTickets.filters).set(f.staffHeaders).expect(200);
  expect(queue.body.data.map((t: any) => t.id)).toEqual(ids);
});
it("replays every metric descriptor against the Queue or outstanding Actions API", async () => {
  const f = await fixture();
  for (const headers of [f.staffHeaders, f.adminHeaders]) {
    const { body: d } = await request(app).get("/api/dashboard/staff").set(headers).expect(200);
    const pairs = [[d.metrics.unassignedActiveTickets, d.drilldowns.unassignedActiveTickets], [d.metrics.myActiveTickets, d.drilldowns.myActiveTickets],
      ...Object.entries(d.metrics.ticketsByStatus).map(([k,v]) => [v,d.drilldowns.ticketsByStatus[k]]),
      ...Object.entries(d.metrics.activeTicketsByItPriority).map(([k,v]) => [v,d.drilldowns.activeTicketsByItPriority[k]]),
      [d.metrics.myOutstandingActions,d.drilldowns.myOutstandingActions]];
    for (const [count, descriptor] of pairs) {
      const r = await request(app).get(descriptor.view === "my-actions" ? "/api/staff/actions" : "/api/staff/tickets").query(descriptor.filters).set(headers).expect(200);
      expect(r.body.pagination.totalItems).toBe(count);
    }
    expect(Object.keys(d.metrics.ticketsByStatus)).toHaveLength(8); expect(Object.keys(d.metrics.activeTicketsByItPriority)).toHaveLength(4);
  }
});
it("excludes completed work regardless of performer and preserves legacy terminal status counts", async () => {
  const f = await fixture();
  const baseline = (await request(app).get("/api/dashboard/staff").set(f.staffHeaders).expect(200)).body;
  for (const currentStatus of ["RESOLVED", "CLOSED", "CANCELLED"] as const) {
    const t = await f.makeTicket();
    await db.ticket.update({ where: { id: t.id }, data: { currentStatus, resolvedAt: null, ownerId: f.staff.id } });
    await db.actionTaken.create({ data: { ticketId: t.id, cycle: 1, description: "Terminal outstanding exclusion",
      assigneeId: f.staff.id, createdById: f.admin.id, clientRequestId: randomUUID(), createRequestHash: "0".repeat(64) } });
  }
  // Completion freezes the assignee as performer; creation remains attributed to Admin.
  for (const assigneeId of [f.staff.id, f.colleague.id]) {
    const occurredAt = new Date();
    await db.actionTaken.create({ data: { ticketId: f.ticket.id, cycle: 1, description: "Completed work", status: "COMPLETED",
      result: "Done", createdAt: occurredAt, completedAt: occurredAt, assigneeId, performedById: assigneeId, createdById: f.admin.id,
      clientRequestId: randomUUID(), createRequestHash: "0".repeat(64) } });
  }
  const { body } = await request(app).get("/api/dashboard/staff").set(f.staffHeaders).expect(200);
  expect(body.metrics.myOutstandingActions).toBe(0); expect(body.myActions.items).toEqual([]);
  expect(body.metrics.myActiveTickets).toBe(0);
  for (const s of ["RESOLVED", "CLOSED", "CANCELLED"]) expect(body.metrics.ticketsByStatus[s]).toBe(baseline.metrics.ticketsByStatus[s] + 1);
  const queue = await request(app).get("/api/staff/tickets").query({ statusGroup: "resolved", ownerId: "me" }).set(f.staffHeaders).expect(200);
  expect(queue.body.pagination.totalItems).toBe(2); expect(queue.body.data.every((t: any) => t.resolvedAt === null)).toBe(true);
});
