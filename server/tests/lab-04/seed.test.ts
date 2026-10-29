import { afterEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { assertTestEnvironment, TEST_DATABASE_URL } from "../lab-03/safety.js";
import { deployThrough } from "../../scripts/migrate-auth.js";
import { seedLab3, seedLab4 } from "../../prisma/seed.js";

const resources: { db: PrismaClient; admin: PrismaClient; schema: string }[] = [];
async function isolated() {
  assertTestEnvironment();
  if (process.env.DATABASE_URL !== TEST_DATABASE_URL) throw new Error("Use the exact disposable database URL.");
  const admin = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
  const [identity] = await admin.$queryRaw<{ database: string; username: string }[]>`SELECT current_database() AS database, current_user AS username`;
  if (identity.database !== "toktickit_lab3_test" || identity.username !== "lab3_test") { await admin.$disconnect(); throw new Error("Unsafe database identity."); }
  const schema = "lab4_seed_" + randomUUID().replaceAll("-", "");
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const url = new URL(TEST_DATABASE_URL); url.searchParams.set("schema", schema);
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  resources.push({ db, admin, schema }); await deployThrough(url.toString());
  return db;
}
afterEach(async () => {
  for (const { db, admin, schema } of resources.splice(0)) {
    await db.$disconnect();
    try {
      if (!/^lab4_seed_[a-f0-9]{32}$/.test(schema)) throw new Error("Unsafe schema cleanup.");
      await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    } finally { await admin.$disconnect(); }
  }
});
const prefix = "L4-DEMO-";
async function snapshot(db: PrismaClient) {
  const result: Record<string, unknown> = {};
  for (const table of ["RequesterUser", "Ticket", "ActionTaken", "ActionTakenRevision", "PublicComment", "InternalNote", "Attachment", "Session", "Category", "RelatedSystem"])
    result[table] = await db.$queryRawUnsafe(`SELECT to_jsonb(t) AS row FROM "${table}" t ORDER BY to_jsonb(t)::text`);
  return result;
}
const noHandover = async () => {};
describe("L4-MIG-02/03 create-only Lab 4 seed", () => {
  it("creates all required scenarios with coherent attribution, lifecycle revisions and cycle dates", async () => {
    const db = await isolated(), handover = vi.fn(noHandover);
    const report = await seedLab4(db, handover);
    expect(report.created).toHaveLength(9); expect(report.changed).toEqual([]); expect(report.unavailable).toEqual([]);
    expect(handover).toHaveBeenCalledTimes(10);
    const tickets = await db.ticket.findMany({ where: { ticketNumber: { startsWith: prefix } }, include: { owner: true,
      actionsTaken: { include: { assignee: true, revisions: { orderBy: { version: "asc" } } } } } });
    expect(new Set(tickets.map(t => t.currentStatus)).size).toBe(8);
    expect(new Set(tickets.map(t => t.itPriority)).size).toBe(4);
    expect(new Set(tickets.map(t => t.requestedPriority)).size).toBe(4);
    expect(tickets.some(t => !t.ownerId)).toBe(true);
    expect(tickets.some(t => t.actionsTaken.length === 0)).toBe(true);
    expect(tickets.some(t => t.actionsTaken.length === 1)).toBe(true);
    expect(tickets.some(t => t.actionsTaken.length > 1)).toBe(true);
    const actions = tickets.flatMap(t => t.actionsTaken);
    expect(actions).toHaveLength(13); expect(await db.actionTakenRevision.count()).toBe(28);
    expect(new Set(actions.map(a => a.status))).toEqual(new Set(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]));
    expect(tickets.some(t => t.actionsTaken.some(a => a.assigneeId !== t.ownerId))).toBe(true);
    expect(actions.some(a => !a.assignee.isActive)).toBe(true);
    expect(actions.some(a => a.createdById !== a.assigneeId && a.performedById === a.assigneeId)).toBe(true);
    expect(actions.some(a => a.followUpRequired && !!a.followUpNote)).toBe(true);
    for (const a of actions) {
      const ops = a.status === "PLANNED" ? ["CREATE"] : a.status === "IN_PROGRESS" ? ["CREATE", "START"] :
        a.status === "COMPLETED" ? ["CREATE", "START", "COMPLETE"] : ["CREATE", "CANCEL"];
      expect(a.revisions.map(r => r.operation)).toEqual(ops);
      expect(a.revisions.map(r => r.version)).toEqual(ops.map((_, i) => i + 1));
      expect(a.version).toBe(ops.length);
      for (const [i, revision] of a.revisions.entries()) {
        const snap = revision.snapshot as Record<string, any>;
        expect(snap).toMatchObject({ id: a.id, ticketId: a.ticketId, cycle: a.cycle, version: i + 1, createdById: a.createdById, assigneeId: a.assigneeId });
        expect(snap.createdAt).toBe(a.createdAt.toISOString());
        expect(snap.updatedAt).toBe(revision.occurredAt.toISOString());
        expect(revision.actorId).toBe(i === 0 || revision.operation === "CANCEL" ? a.createdById : a.assigneeId);
        expect(snap.status).toBe(i === 0 ? "PLANNED" : revision.operation === "START" ? "IN_PROGRESS" : a.status);
        if (revision.operation === "COMPLETE") {
          expect(snap.performedById).toBe(a.assigneeId); expect(snap.result).toBeTruthy();
          expect(snap.completedAt).toBe(revision.occurredAt.toISOString());
        } else expect(snap.performedById).toBeNull();
        expect(JSON.stringify(snap)).not.toMatch(/passwordHash|createRequestHash|clientRequestId|emailNormalized/);
        if (i) expect(revision.occurredAt.getTime()).toBeGreaterThan(a.revisions[i - 1].occurredAt.getTime());
      }
      const { revisions, assignee, clientRequestId, createRequestHash, ...scalars } = a;
      expect(revisions.at(-1)!.snapshot).toEqual(JSON.parse(JSON.stringify(scalars)));
    }
    const reopened = tickets.find(t => t.currentStatus === "REOPENED")!;
    expect(reopened).toMatchObject({ workCycle: 2, resolvedAt: null, resolutionSuggestedAt: null });
    expect(reopened.actionsTaken.some(a => a.cycle === 1 && a.status === "COMPLETED")).toBe(true);
    expect(reopened.actionsTaken.some(a => a.cycle === 2 && a.status === "PLANNED")).toBe(true);
    const reason = await db.publicComment.findFirstOrThrow({ where: { ticketId: reopened.id } });
    expect(Math.max(...reopened.actionsTaken.filter(a => a.cycle === 1).map(a => a.updatedAt.getTime()))).toBeLessThan(reason.createdAt.getTime());
    expect(Math.min(...reopened.actionsTaken.filter(a => a.cycle === 2).map(a => a.createdAt.getTime()))).toBeGreaterThan(reason.createdAt.getTime());
    for (const t of tickets.filter(t => ["RESOLVED", "CLOSED"].includes(t.currentStatus))) {
      expect(t.owner?.isActive).toBe(true); expect(t.resolvedAt).not.toBeNull();
      expect(t.actionsTaken.every(a => a.status === "COMPLETED" && !a.followUpRequired)).toBe(true);
      expect(t.resolvedAt!.getTime()).toBeGreaterThan(Math.max(...t.actionsTaken.map(a => a.completedAt!.getTime())));
    }
    const empty = await db.user.findUniqueOrThrow({ where: { emailNormalized: "david.lee@example.com" } });
    expect(await db.ticket.count({ where: { requesterId: empty.id } })).toBe(0);
  });
  it("preserves every row and credential exactly on repeated runs", async () => {
    const db = await isolated(); await seedLab4(db, noHandover);
    const before = await snapshot(db), handover = vi.fn(noHandover);
    for (let i = 0; i < 2; i++) {
      const report = await seedLab4(db, handover);
      expect(report.created).toEqual([]); expect(report.retained).toHaveLength(9); expect(report.changed).toEqual([]);
      expect(await snapshot(db)).toEqual(before);
    }
    expect(handover).not.toHaveBeenCalled();
  });
  it("retains changed accounts, progress, ownership, Action history and discussion rather than reconciling graphs", async () => {
    const db = await isolated(); await seedLab4(db, noHandover);
    const t = await db.ticket.findUniqueOrThrow({ where: { ticketNumber: prefix + "002" }, include: { actionsTaken: true } });
    const a = t.actionsTaken[0], user = await db.user.findUniqueOrThrow({ where: { emailNormalized: "staff1@example.com" } });
    const next = await db.actionTaken.update({ where: { id: a.id }, data: { description: "Student work", version: { increment: 1 } } });
    const { clientRequestId, createRequestHash, ...scalars } = next;
    await db.actionTakenRevision.create({ data: { actionId: a.id, actorId: a.createdById, version: 2, operation: "EDIT",
      occurredAt: next.updatedAt, snapshot: JSON.parse(JSON.stringify(scalars)) } });
    await db.ticket.update({ where: { id: t.id }, data: { summary: "Student progress", currentStatus: "WAITING_FOR_REQUESTER", ownerId: null, workflowVersion: { increment: 2 } } });
    await db.publicComment.create({ data: { ticketId: t.id, authorId: t.requesterId, body: "Keep this discussion" } });
    const editedGraph = await snapshot(db);
    expect((await seedLab4(db, noHandover)).changed).toEqual([t.ticketNumber]);
    expect(await snapshot(db)).toEqual(editedGraph);
    await db.user.update({ where: { id: user.id }, data: { name: "Student edited", role: "REQUESTER", isActive: false,
      passwordHash: "student-retained-hash", mustChangePassword: false } });
    await db.session.create({ data: { tokenHash: "seed-preservation-session", csrfToken: "test", userId: user.id, lastSeenAt: new Date(), expiresAt: new Date("2030-01-01") } });
    const before = await snapshot(db), handover = vi.fn(noHandover);
    const report = await seedLab4(db, handover);
    expect(report.changed).toContain(t.ticketNumber); expect(report.created).toEqual([]);
    expect(await snapshot(db)).toEqual(before); expect(handover).not.toHaveBeenCalled();
  });
  it("skips existing Ticket numbers without adding children, and reports ineligible dependencies for missing graphs", async () => {
    const db = await isolated(); await seedLab3(db, noHandover);
    const old = await db.ticket.findFirstOrThrow();
    const collision = await db.ticket.create({ data: { ticketNumber: prefix + "003", summary: "User-owned collision", description: "Keep",
      requesterId: old.requesterId, categoryId: old.categoryId, relatedSystemId: old.relatedSystemId, currentStatus: "CLOSED" } });
    const staff = await db.user.update({ where: { emailNormalized: "staff2@example.com" }, data: { role: "REQUESTER", isActive: false } });
    const report = await seedLab4(db, noHandover);
    expect(report.retained).toContain(collision.ticketNumber); expect(report.changed).toContain(collision.ticketNumber);
    expect(report.unavailable.length).toBeGreaterThan(0);
    expect(await db.ticket.findUniqueOrThrow({ where: { id: collision.id } })).toEqual(collision);
    expect(await db.actionTaken.count({ where: { ticketId: collision.id } })).toBe(0);
    expect(await db.user.findUniqueOrThrow({ where: { id: staff.id } })).toEqual(staff);
  });
  it("rolls back the whole fixture graph after a revision failure and recovers on retry", async () => {
    const db = await isolated(); await seedLab3(db, noHandover);
    let failed = false;
    const fault = db.$extends({ query: { actionTakenRevision: { async create({ args, query }) {
      const row = await query(args);
      if (!failed && args.data.operation === "START") { failed = true; throw new Error("Injected seed failure"); }
      return row;
    } } } });
    await expect(seedLab4(fault as unknown as PrismaClient, noHandover)).rejects.toThrow("Injected seed failure");
    expect(failed).toBe(true);
    expect(await db.ticket.findUnique({ where: { ticketNumber: prefix + "003" } })).toBeNull();
    expect(await db.actionTaken.count()).toBe(1); expect(await db.actionTakenRevision.count()).toBe(1);
    const report = await seedLab4(db, noHandover);
    expect(report.created).toHaveLength(7); expect(await db.actionTaken.count()).toBe(13); expect(await db.actionTakenRevision.count()).toBe(28);
  });
  it("serializes concurrent seed graph creation without duplicate Actions or revisions", async () => {
    const db = await isolated(); await seedLab3(db, noHandover);
    const reports = await Promise.all([seedLab4(db, noHandover), seedLab4(db, noHandover)]);
    expect(reports.reduce((n, r) => n + r.created.length, 0)).toBe(9);
    expect(await db.actionTaken.count()).toBe(13); expect(await db.actionTakenRevision.count()).toBe(28);
    expect(await db.ticket.count({ where: { ticketNumber: { startsWith: prefix } } })).toBe(9);
  });
});
