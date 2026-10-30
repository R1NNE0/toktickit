import request from "supertest";
import { expect, it } from "vitest";
import { cpus, totalmem, platform, release } from "node:os";
import { app } from "../../src/app.js";
import { fixture, db } from "./api-fixtures.js";

// Uses only the repository's guarded, disposable PostgreSQL Vitest environment.
// api-fixtures tracks these Tickets and removes their Actions before cleanup.
it("bounds previews and latency with 300 Tickets and 900 assigned Actions", async () => {
  const f = await fixture(), tickets = [f.ticket];
  for (let i = 1; i < 300; i++) tickets.push(await f.makeTicket());
  await db.actionTaken.createMany({ data: tickets.flatMap((t, index) => Array.from({ length: 3 }, (_, n) => ({
    ticketId: t.id, cycle: 1, description: "Performance smoke fixture ".repeat(12), assigneeId: f.staff.id, createdById: f.staff.id,
    clientRequestId: `00000000-0000-4000-8000-${String(index * 3 + n).padStart(12, "0")}`, createRequestHash: "0".repeat(64),
  }))) });
  const timings: number[] = []; let bytes = 0;
  for (let i = 0; i < 25; i++) {
    const started = performance.now(); const r = await request(app).get("/api/dashboard/staff").set(f.staffHeaders).expect(200);
    const elapsed = performance.now() - started; if (i >= 5) timings.push(elapsed);
    expect(r.body.metrics.myOutstandingActions).toBe(900); expect(r.body.myActions.total).toBe(900);
    expect(r.body.myActions.items).toHaveLength(5); expect(r.body.recentTickets.length).toBeLessThanOrEqual(5);
    bytes = Buffer.byteLength(JSON.stringify(r.body)); expect(bytes).toBeLessThanOrEqual(65536);
  }
  const p95 = timings.sort((a,b) => a-b)[18];
  const version = await db.$queryRaw`SELECT version()`;
  console.info({ dataset: "300 Tickets / 900 Actions", totalTickets: await db.ticket.count(), node: process.version,
    postgres: version, os: platform() + " " + release(), cpu: cpus()[0]?.model, memoryBytes: totalmem(), p95, bytes });
  expect(p95).toBeLessThanOrEqual(1000);
}, 60000);
