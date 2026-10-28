import { afterEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { assertTestEnvironment, TEST_DATABASE_URL } from "../lab-03/safety.js";
import { deployThrough } from "../../scripts/migrate-auth.js";
import { seedLab3 } from "../../prisma/seed.js";

const migrationName = "20261028000100_lab4_actions_taken";
const resources: { db: PrismaClient; admin: PrismaClient; schema: string; file?: string }[] = [];
async function isolated(legacy = false) {
  assertTestEnvironment();
  // This dedicated runner never drops or seeds the existing public schema.
  if (process.env.DATABASE_URL !== TEST_DATABASE_URL) throw new Error("Use the exact configured disposable test URL.");
  const admin = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
  try {
    const [identity] = await admin.$queryRaw<{ database: string; username: string }[]>`SELECT current_database() AS database, current_user AS username`;
    if (identity.database !== "toktickit_lab3_test" || identity.username !== "lab3_test") throw new Error("Disposable database identity mismatch.");
    const schema = "lab4_migration_" + randomUUID().replaceAll("-", "");
    // No IF NOT EXISTS: cleanup must only own a schema this invocation created.
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const url = new URL(TEST_DATABASE_URL); url.searchParams.set("schema", schema);
    const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    const resource = { admin, db, schema, file: undefined as string | undefined };
    resources.push(resource);
    await deployThrough(url.toString(), legacy ? "20260918000100_comments_notes_workflow" : undefined);
    return { ...resource, resource, url: url.toString() };
  } catch (error) { if (!resources.some(r => r.admin === admin)) await admin.$disconnect(); throw error; }
}
afterEach(async () => {
  for (const resource of resources.splice(0)) {
    await resource.db.$disconnect();
    try {
      if (!/^lab4_migration_[a-f0-9]{32}$/.test(resource.schema)) throw new Error("Unsafe cleanup schema.");
      await resource.admin.$executeRawUnsafe(`DROP SCHEMA "${resource.schema}" CASCADE`);
      if (resource.file) await unlink(resource.file);
    } finally { await resource.admin.$disconnect(); }
  }
});

async function legacyRows(db: PrismaClient) {
  // Explicit old columns/raw writes avoid selecting Lab 4 fields before upgrade.
  await db.$executeRawUnsafe(`INSERT INTO "RequesterUser" (id,name,email,"emailNormalized",role,"passwordHash","mustChangePassword","updatedAt") VALUES
    (1,'Requester','jennifer.anderson@example.com','jennifer.anderson@example.com','REQUESTER','retained-hash',false,'2026-01-01'),
    (2,'Staff','staff1@example.com','staff1@example.com','IT_STAFF','retained-staff-hash',false,'2026-01-01');`);
  await db.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"RequesterUser"','id'),2)`);
  await db.$executeRawUnsafe(`INSERT INTO "Category" (id,name) VALUES (1,'Hardware')`);
  await db.$executeRawUnsafe(`INSERT INTO "RelatedSystem" (id,name) VALUES (1,'Email')`);
  await db.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Category"','id'),1)`);
  await db.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"RelatedSystem"','id'),1)`);
  for (const [i,status] of ["NEW","OPEN","IN_PROGRESS","WAITING_FOR_REQUESTER","RESOLVED","CLOSED","REOPENED","CANCELLED"].entries()) {
    await db.$executeRaw`INSERT INTO "Ticket" ("ticketNumber",summary,description,"requesterId","ownerId","categoryId","relatedSystemId","currentStatus","createdAt","updatedAt")
      VALUES (${`LEGACY-L4-${i}`},'Preserve','Historical',1,2,1,1,${status}::"TicketStatus",'2026-01-01','2026-02-01')`;
  }
  await db.$executeRawUnsafe(`INSERT INTO "PublicComment" ("ticketId","authorId",body) VALUES (1,1,'Public history')`);
  await db.$executeRawUnsafe(`INSERT INTO "InternalNote" ("ticketId","authorId",body) VALUES (1,2,'Private history')`);
  await db.$executeRawUnsafe(`INSERT INTO "Session" ("tokenHash","userId","csrfToken","lastSeenAt","expiresAt") VALUES ('legacy-session',1,'legacy-csrf','2026-01-01','2030-01-01')`);
}
async function snapshot(db: PrismaClient) {
  const result: Record<string, unknown> = {};
  for (const table of ["RequesterUser","Ticket","Attachment","PublicComment","InternalNote","Session","Category","RelatedSystem"]) {
    // Strip only new columns so every historical column remains compared.
    result[table] = await db.$queryRawUnsafe(`SELECT to_jsonb(t) - 'workflowVersion' - 'workCycle' - 'resolvedAt' AS row FROM "${table}" t ORDER BY (to_jsonb(t) - 'workflowVersion' - 'workCycle' - 'resolvedAt')::text`);
  }
  return result;
}
async function fixture(db: PrismaClient) {
  const user = await db.user.create({ data: { name: "Staff", email: "fixture@example.com", emailNormalized: "fixture@example.com", role: "IT_STAFF", passwordHash: "test-only", mustChangePassword: false } });
  const category = await db.category.create({ data: { name: "Hardware" } });
  const system = await db.relatedSystem.create({ data: { name: "Email" } });
  const ticket = await db.ticket.create({ data: { ticketNumber: "L4-TEST", summary: "Test", description: "Test", requesterId: user.id, categoryId: category.id, relatedSystemId: system.id } });
  const data = { ticketId: ticket.id, cycle: 1, description: "Work", assigneeId: user.id, createdById: user.id, clientRequestId: randomUUID(), createRequestHash: "a".repeat(64) };
  return { user, ticket, data };
}

describe("L4-MIG-01/03/04 Actions foundation", () => {
  it("installs fresh models, indexes and paired relations with the documented defaults", async () => {
    const { db } = await isolated(); const { data, ticket, user } = await fixture(db);
    expect(ticket).toMatchObject({ workflowVersion: 1, workCycle: 1, resolvedAt: null });
    const action = await db.actionTaken.create({ data, include: { ticket: true, createdBy: true, assignee: true, performedBy: true, revisions: true } });
    expect(action).toMatchObject({ status: "PLANNED", version: 1, performedBy: null, revisions: [] });
    const revision = await db.actionTakenRevision.create({ data: { actionId: action.id, actorId: user.id, version: 1, operation: "CREATE", snapshot: { status: "PLANNED" } } });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { createdActionsTaken: true, assignedActionsTaken: true, performedActionsTaken: true, actionTakenRevisions: true } })).actionTakenRevisions[0].id).toBe(revision.id);
    const indexes = await db.$queryRaw<{ indexdef: string }[]>`SELECT indexdef FROM pg_indexes WHERE schemaname=current_schema()`;
    for (const columns of ['("ticketId", cycle, "createdAt", id)','("ticketId", cycle, status)','("assigneeId", status, "ticketId")','("ownerId", "currentStatus")','("currentStatus", "itPriority")','("updatedAt", id)','("requesterId", "updatedAt", id)','("requesterId", "resolvedAt", id)'])
      expect(indexes.some(i => i.indexdef.includes(columns))).toBe(true);
    const keys = await db.$queryRaw<{ name: string; target: string; deletion: string }[]>`
      SELECT c.conname AS name, t.relname AS target, c.confdeltype::text AS deletion
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.confrelid
      JOIN pg_namespace n ON n.oid=c.connamespace
      WHERE n.nspname=current_schema() AND c.contype='f'
        AND c.conrelid IN ('"ActionTaken"'::regclass, '"ActionTakenRevision"'::regclass)`;
    expect(keys).toHaveLength(6);
    for (const [name, target] of [
      ["ActionTaken_ticketId_fkey", "Ticket"],
      ["ActionTaken_createdById_fkey", "RequesterUser"],
      ["ActionTaken_assigneeId_fkey", "RequesterUser"],
      ["ActionTaken_performedById_fkey", "RequesterUser"],
      ["ActionTakenRevision_actionId_fkey", "ActionTaken"],
      ["ActionTakenRevision_actorId_fkey", "RequesterUser"],
    ]) expect(keys).toContainEqual({ name, target, deletion: "r" });
  });
  it("preserves all Lab 3 records, sessions and attachment bytes; old seed can run twice safely", async () => {
    const { db, url, resource } = await isolated(true); await legacyRows(db);
    const dir = path.resolve(process.env.TEST_UPLOAD_ROOT!); await mkdir(dir, { recursive: true });
    const file = path.join(dir, "lab4-migration-" + randomUUID() + ".pdf"); resource.file = file;
    const bytes = Buffer.from("%PDF-1.4 preserved fixture");
    await writeFile(file, bytes);
    await db.attachment.create({ data: { ticketId: 1, fileName: "history.pdf", storedPath: file, fileSize: bytes.length, mimeType: "application/pdf", isRemoved: true, removedAt: new Date("2026-01-01"), removalReason: "retain" } });
    const digest = createHash("sha256").update(await readFile(file)).digest("hex"), before = await snapshot(db);
    await deployThrough(url);
    expect(await snapshot(db)).toEqual(before);
    expect(await db.actionTaken.count()).toBe(0);
    expect(await db.ticket.findMany({ select: { workflowVersion: true, workCycle: true, resolvedAt: true } })).toEqual(Array(8).fill({ workflowVersion: 1, workCycle: 1, resolvedAt: null }));
    expect(createHash("sha256").update(await readFile(file)).digest("hex")).toBe(digest);
    await seedLab3(db, async () => {});
    const seeded = await snapshot(db);
    await seedLab3(db, async () => { throw new Error("No credential reprovisioning"); });
    expect(await snapshot(db)).toEqual(seeded);
    for (const [table, rows] of Object.entries(before)) expect(seeded[table]).toEqual(expect.arrayContaining(rows as unknown[]));
  });
  it("rejects invalid lifecycle/null combinations and duplicate keys without losing valid work", async () => {
    const { db } = await isolated(); const { data, user } = await fixture(db);
    const action = await db.actionTaken.create({ data });
    await expect(db.actionTaken.create({ data })).rejects.toThrow();
    await db.actionTakenRevision.create({ data: { actionId: action.id, actorId: user.id, version: 1, operation: "CREATE", snapshot: {} } });
    await expect(db.actionTakenRevision.create({ data: { actionId: action.id, actorId: user.id, version: 1, operation: "EDIT", snapshot: {} } })).rejects.toThrow();
    for (const invalid of [
      { description: " \t\n" }, { description: "\u00a0\u2003\ufeff" }, { description: "😀".repeat(4001) },
      { followUpRequired: true, followUpNote: null }, { followUpRequired: true, followUpNote: " \n" },
      { followUpNote: "😀".repeat(2001) }, { attachmentNotes: "😀".repeat(2001) },
      { result: "x".repeat(4001) }, { cycle: 0 }, { version: 0 },
      { status: "COMPLETED" as const, result: null, performedById: user.id, completedAt: new Date() },
      { status: "COMPLETED" as const, result: "done", performedById: null, completedAt: new Date() },
      { status: "COMPLETED" as const, result: "done", performedById: user.id, completedAt: null },
      { status: "COMPLETED" as const, result: " ", performedById: user.id, completedAt: new Date() },
      { status: "COMPLETED" as const, result: "done", performedById: user.id, completedAt: new Date(), cancelledAt: new Date(), cancellationReason: "why" },
      { status: "CANCELLED" as const, cancellationReason: null, cancelledAt: new Date() },
      { status: "CANCELLED" as const, cancellationReason: "why", cancelledAt: null },
      { status: "CANCELLED" as const, cancellationReason: " ", cancelledAt: new Date() },
      { status: "CANCELLED" as const, cancellationReason: "x".repeat(4001), cancelledAt: new Date() },
      { status: "CANCELLED" as const, cancellationReason: "why", cancelledAt: new Date(), performedById: user.id },
      { completedAt: new Date() }, { cancellationReason: "why" },
    ]) await expect(db.actionTaken.create({ data: { ...data, clientRequestId: randomUUID(), ...invalid } })).rejects.toThrow();
    await expect(db.actionTaken.create({ data: { ...data, clientRequestId: randomUUID(), description: "😀".repeat(4000) } })).resolves.toBeDefined();
    await expect(db.ticket.delete({ where: { id: data.ticketId } })).rejects.toThrow();
    await expect(db.user.delete({ where: { id: user.id } })).rejects.toThrow();
    await expect(db.actionTaken.delete({ where: { id: action.id } })).rejects.toThrow();
    await expect(db.actionTaken.create({ data: { ...data, ticketId: 2147483647, clientRequestId: randomUUID() } })).rejects.toThrow();
    await expect(db.ticket.update({ where: { id: data.ticketId }, data: { workflowVersion: 0 } })).rejects.toThrow();
    await expect(db.ticket.update({ where: { id: data.ticketId }, data: { workCycle: 0 } })).rejects.toThrow();
    for (const invalid of [{ version: 0 }, { changeReason: " " }, { changeReason: "😀".repeat(4001) }, { actorId: 2147483647 }, { actionId: 2147483647 }]) {
      await expect(db.actionTakenRevision.create({ data: { actionId: action.id, actorId: user.id, version: 2, operation: "EDIT", snapshot: {}, ...invalid } })).rejects.toThrow();
    }
    expect(await db.actionTaken.findUniqueOrThrow({ where: { id: action.id } })).toMatchObject({ version: 1, status: "PLANNED" });
  });
  it("accepts every coherent lifecycle, nullable content and Unicode boundary values", async () => {
    const { db } = await isolated(); const { data, user } = await fixture(db);
    for (const state of [
      { status: "PLANNED" as const },
      { status: "IN_PROGRESS" as const, followUpRequired: true, followUpNote: "😀".repeat(2000) },
      { status: "COMPLETED" as const, result: "😀".repeat(4000), performedById: user.id, completedAt: new Date(), followUpRequired: true, followUpNote: "Check tomorrow" },
      { status: "CANCELLED" as const, result: "Partial findings", cancellationReason: "😀".repeat(4000), cancelledAt: new Date() },
    ]) {
      const saved = await db.actionTaken.create({ data: { ...data, clientRequestId: randomUUID(), attachmentNotes: "😀".repeat(2000), ...state } });
      expect(saved).toMatchObject(state);
    }
    // Same request UUID belongs to a creator, not a global or per-Ticket key.
    const other = await db.user.create({ data: { name: "Other", email: "other@example.com", emailNormalized: "other@example.com", passwordHash: "test-only", role: "IT_STAFF" } });
    await db.actionTaken.create({ data });
    await expect(db.actionTaken.create({ data: { ...data, createdById: other.id } })).resolves.toBeDefined();
    for (const field of ["createdById", "assigneeId"] as const) {
      await expect(db.actionTaken.create({ data: { ...data, [field]: 2147483647, clientRequestId: randomUUID() } })).rejects.toThrow();
    }
  });
  it("rolls back failed additive DDL and safely deploys it again without changing historical rows", async () => {
    const { db, url } = await isolated(true); await legacyRows(db); const before = await snapshot(db);
    const sql = await readFile(path.resolve("prisma/migrations", migrationName, "migration.sql"), "utf8");
    const statements = sql.replace(/--[^\n]*/g, "").split(";").map(s => s.trim()).filter(s => s && !/^(BEGIN|COMMIT)$/i.test(s));
    await expect(db.$transaction(async tx => {
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      throw new Error("Injected failure before commit");
    }, { timeout: 30000 })).rejects.toThrow("Injected failure");
    expect(await snapshot(db)).toEqual(before);
    const columns = await db.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='Ticket' AND column_name='workflowVersion'`;
    expect(Number(columns[0].count)).toBe(0);
    await deployThrough(url); expect(await snapshot(db)).toEqual(before);
    await deployThrough(url); expect(await snapshot(db)).toEqual(before);
  });
  it("rolls back an Action/revision transaction and keeps timestamps as UTC instants", async () => {
    const { db } = await isolated(); const { data, user } = await fixture(db);
    await expect(db.$transaction(async tx => {
      const a = await tx.actionTaken.create({ data });
      await tx.actionTakenRevision.create({ data: { actionId: a.id, actorId: user.id, version: 1, operation: "CREATE", snapshot: {} } });
      throw new Error("Injected revision failure");
    })).rejects.toThrow("Injected revision failure");
    expect(await db.actionTaken.count()).toBe(0); expect(await db.actionTakenRevision.count()).toBe(0);
    await db.actionTaken.create({ data });
    const types = await db.$queryRaw<{ column_name: string; data_type: string }[]>`SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='Ticket' AND column_name IN ('createdAt','updatedAt','resolvedAt')`;
    expect(types).toEqual(expect.arrayContaining([
      { column_name: "updatedAt", data_type: "timestamp without time zone" },
      { column_name: "resolvedAt", data_type: "timestamp with time zone" },
    ]));
    const instant = new Date("2026-10-28T00:00:00.000Z");
    await db.ticket.update({ where: { id: data.ticketId }, data: { resolvedAt: instant } });
    for (const zone of ["UTC", "Asia/Bangkok"]) {
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT set_config('TimeZone', ${zone}, true)`;
        expect((await tx.ticket.findUniqueOrThrow({ where: { id: data.ticketId } })).resolvedAt).toEqual(instant);
      });
    }
  });
});
