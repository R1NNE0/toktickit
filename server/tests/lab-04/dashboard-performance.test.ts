import request from "supertest";
import { expect, it, vi } from "vitest";
import { cpus, totalmem, platform, release } from "node:os";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { dashboardClock } from "../../src/staffDashboard.js";
import { performanceFixture } from "./dashboard-performance-fixture.js";

it("verifies all dashboards using the contract dataset and measured bounded queries", async () => {
  const db = getPrisma(), f = await performanceFixture();
  try {
    vi.spyOn(dashboardClock, "now").mockImplementation(async tx =>
      (await tx.$queryRaw<{ now: Date }[]>`SELECT ${f.to}::timestamptz AS now`)[0].now);
    expect(await db.actionTaken.count({ where: { ticketId: { in: f.tickets } } })).toBe(900);
    expect(await db.ticket.count({ where: { ticketNumber: { startsWith: f.marker } } })).toBe(300);
    const all = await db.ticket.findMany(), actions = await db.actionTaken.findMany();
    const active = (s: string) => ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].includes(s);
    const within = (d: Date | null) => d !== null && +d >= +f.from && +d < +f.to;
    const version = await db.$queryRaw`SELECT version()`;
    const original = db.$transaction.bind(db); let queries = 0;
    vi.spyOn(db, "$transaction").mockImplementation(((fn: any, options: any) => original(async (tx: any) => fn(new Proxy(tx, {
      get(target, key) {
        if (key === "$queryRaw") return (...args: any[]) => { queries++; return target.$queryRaw(...args); };
        return Reflect.get(target, key);
      },
    })), options)) as any);
    for (const [role, userId, headers] of [
      ["staff", f.users[7], f.staffHeaders], ["admin", f.users[9], f.adminHeaders],
      ["requester", f.users[0], f.requesterHeaders], ["zero-requester", f.users[6], f.zeroHeaders],
    ] as const) {
      const operational = role === "staff" || role === "admin", scope = all.filter(t => operational || t.requesterId === userId);
      const expectedActions = actions.filter(a => a.assigneeId === userId && ["PLANNED", "IN_PROGRESS"].includes(a.status)
        && all.some(t => t.id === a.ticketId && active(t.currentStatus) && t.workCycle === a.cycle));
      const timings: number[] = []; let bytes = 0, maxQueries = 0;
      for (let i = 0; i < 25; i++) {
        queries = 0; const started = performance.now();
        const r = await request(app).get(`/api/dashboard/${operational ? "staff" : "requester"}`).set(headers).expect(200);
        const elapsed = performance.now() - started; if (i >= 5) timings.push(elapsed);
        maxQueries = Math.max(maxQueries, queries); expect(queries).toBeLessThanOrEqual(6);
        const d = r.body;
        const recent = scope.filter(t => within(t.updatedAt)).sort((a,b) => +b.updatedAt - +a.updatedAt || b.id - a.id).slice(0,5);
        expect(d.recentTickets.map((t: any) => t.id)).toEqual(recent.map(t => t.id));
        if (operational) {
          expect(d.metrics.unassignedActiveTickets).toBe(scope.filter(t => active(t.currentStatus) && t.ownerId === null).length);
          expect(d.metrics.myActiveTickets).toBe(scope.filter(t => active(t.currentStatus) && t.ownerId === userId).length);
          for (const s of Object.keys(d.metrics.ticketsByStatus)) expect(d.metrics.ticketsByStatus[s]).toBe(scope.filter(t => t.currentStatus === s).length);
          for (const p of Object.keys(d.metrics.activeTicketsByItPriority)) expect(d.metrics.activeTicketsByItPriority[p]).toBe(scope.filter(t => active(t.currentStatus) && t.itPriority === p).length);
          expect(d.metrics.myOutstandingActions).toBe(expectedActions.length); expect(d.myActions.total).toBe(expectedActions.length);
          expect(d.myActions.items.map((a: any) => a.id)).toEqual(expectedActions.sort((a,b) => +a.createdAt - +b.createdAt || a.id - b.id).slice(0,5).map(a => a.id));
          expect(d.myActions.items.every((a: any) => [...a.descriptionExcerpt].length <= 200)).toBe(true);
        } else expect(d.metrics).toEqual({ activeTickets: scope.filter(t => active(t.currentStatus)).length,
          waitingForYou: scope.filter(t => t.currentStatus === "WAITING_FOR_REQUESTER").length,
          resolvedLast7Days: scope.filter(t => ["RESOLVED", "CLOSED"].includes(t.currentStatus) && within(t.resolvedAt)).length,
          updatedLast7Days: scope.filter(t => within(t.updatedAt)).length });
        bytes = Buffer.byteLength(JSON.stringify(d)); expect(bytes).toBeLessThanOrEqual(65536);
      }
      const p95 = timings.sort((a,b) => a-b)[18]; expect(p95).toBeLessThanOrEqual(1000);
      console.info({ role, fixtureTickets: 300, fixtureActions: 900, totalTickets: all.length, totalActions: actions.length,
        queries: maxQueries, timingsMs: timings, p95Ms: p95, responseBytes: bytes, clock: f.to.toISOString(), node: process.version,
        postgres: version, os: platform() + " " + release(), cpu: cpus()[0]?.model, memoryBytes: totalmem(), revision: "not inspected: Git commands prohibited" });
    }
  } finally { vi.restoreAllMocks(); await f.cleanup(); }
}, 120000);
