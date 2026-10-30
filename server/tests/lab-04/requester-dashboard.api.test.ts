import request from "supertest";
import { afterEach, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import { dashboardClock } from "../../src/staffDashboard.js";
import { fixture, db } from "./api-fixtures.js";
afterEach(() => vi.restoreAllMocks());
const url = "/api/dashboard/requester";
it("restricts roles and caller scope, returns real zeros, and never caches private errors", async () => {
  const f = await fixture();
  await request(app).get(url).expect(401);
  for (const headers of [f.staffHeaders, f.adminHeaders]) {
    const r = await request(app).get(url).set(headers).expect(403); expect(r.headers["cache-control"]).toBe("no-store");
  }
  for (const query of [{ requesterId: f.other.id }, { from: "2026-01-01" }]) await request(app).get(url).query(query).set(f.requesterHeaders).expect(400);
  await request(app).get(url).send({ requesterId: f.other.id }).set(f.requesterHeaders).expect(400);
  const { body } = await request(app).get(url).set(f.otherHeaders).expect(200);
  expect(body.metrics).toEqual({ activeTickets: 0, waitingForYou: 0, updatedLast7Days: 0, resolvedLast7Days: 0 });
  expect(body.recentTickets).toEqual([]); expect(body).not.toHaveProperty("myActions");
});
it("scopes every status, reopened and legacy resolution, UTC bounds, ties, preview caps and drill-downs", async () => {
  const f = await fixture(), to = new Date("2030-01-08T00:00:00Z"), from = new Date("2030-01-01T00:00:00Z");
  vi.spyOn(dashboardClock, "now").mockResolvedValue(to);
  // Put the default fixture outside the window; it still counts as active.
  await db.ticket.update({ where: { id: f.ticket.id }, data: { updatedAt: new Date(+from - 1) } });
  const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED", "RESOLVED", "CLOSED", "CANCELLED"] as const;
  const expectedRecent: number[] = [];
  for (const currentStatus of statuses) {
    const t = await f.makeTicket(); expectedRecent.push(t.id);
    await db.ticket.update({ where: { id: t.id }, data: { currentStatus, updatedAt: from,
      workCycle: currentStatus === "REOPENED" ? 2 : 1, resolvedAt: ["RESOLVED", "CLOSED"].includes(currentStatus) ? from : null } });
  }
  for (const [currentStatus, resolvedAt] of [["RESOLVED", null], ["CLOSED", to], ["RESOLVED", new Date(+from - 1)], ["REOPENED", from]] as const) {
    const t = await f.makeTicket(); await db.ticket.update({ where: { id: t.id }, data: { currentStatus, resolvedAt, updatedAt: to } });
  }
  const foreign = await f.makeTicket(f.other.id);
  await db.ticket.update({ where: { id: foreign.id }, data: { updatedAt: from, currentStatus: "WAITING_FOR_REQUESTER" } });
  const { body: d } = await request(app).get(url).set(f.requesterHeaders).expect(200);
  expect(d.metrics).toEqual({ activeTickets: 7, waitingForYou: 1, resolvedLast7Days: 2, updatedLast7Days: 8 });
  expect(d.recentWindow).toEqual({ from: from.toISOString(), to: to.toISOString() });
  expect(d.recentTickets.map((t: any) => t.id)).toEqual(expectedRecent.reverse().slice(0,5));
  for (const t of d.recentTickets) expect(Object.keys(t).sort()).toEqual(["id", "ticketNumber", "summary", "currentStatus", "requestedPriority", "itPriority", "owner", "updatedAt", "resolvedAt"].sort());
  for (const key of Object.keys(d.metrics)) {
    const list = await request(app).get("/api/tickets").query(d.drilldowns[key].filters).set(f.requesterHeaders).expect(200);
    expect(list.body.pagination.totalItems).toBe(d.metrics[key]);
    expect(list.body.data.every((t: any) => t.requesterId === f.requester.id)).toBe(true);
  }
  const offset = await request(app).get("/api/tickets").query({ updatedFrom: "2030-01-01T07:00:00+07:00", updatedTo: "2030-01-08T07:00:00+07:00" }).set(f.requesterHeaders).expect(200);
  expect(offset.body.pagination.totalItems).toBe(8);
  for (const query of [{ statusGroup: "active", status: "NEW" }, { ownerId: "me" }, { itPriority: "HIGH" }, { updatedFrom: from.toISOString() }])
    await request(app).get("/api/tickets").query(query).set(f.requesterHeaders).expect(400);
});
