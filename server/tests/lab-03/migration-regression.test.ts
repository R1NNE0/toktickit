import { describe, it, expect, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { createAuth, authErrorHandler } from "../../src/auth/http.js";
import { PrismaClient } from "@prisma/client";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { deployThrough, migrateAuth, type Handover } from "../../scripts/migrate-auth.js";
import { seedLab3 } from "../../prisma/seed.js";
import { verifyPassword } from "../../src/auth/password.js";
import { assertTestEnvironment } from "./safety.js";
const clients: PrismaClient[] = [];
async function legacy() {
  assertTestEnvironment();
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set("schema", "migration_" + randomUUID().replaceAll("-", ""));
  await deployThrough(url.toString(), "20260904083800_add_ticket_idempotency_key");
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } }); clients.push(db);
  await db.$executeRawUnsafe(`INSERT INTO "RequesterUser" (name,email,"isActive","updatedAt") VALUES
    ('Seeded','jennifer.anderson@example.com',true,'2026-01-01'),
    ('Non-seeded','nonseed@example.com',true,'2026-02-01'),
    ('Inactive','inactive@example.com',false,'2026-03-01')`);
  await db.category.create({ data: { name: "Hardware" } });
  await db.relatedSystem.create({ data: { name: "Email" } });
  const ticket = await db.ticket.create({ data: { ticketNumber: "LEGACY-1", summary: "Keep every field",
    description: "Preserve history", requesterId: 2, categoryId: 1, relatedSystemId: 1, idempotencyKey: "legacy-key", currentStatus: "CLOSED" } });
  const file = path.resolve(process.env.TEST_UPLOAD_ROOT!, randomUUID() + ".pdf");
  await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, "%PDF-1.4 legacy bytes");
  await db.attachment.create({ data: { ticketId: ticket.id, fileName: "legacy.pdf", storedPath: file,
    fileSize: 21, mimeType: "application/pdf", isRemoved: true, removedAt: new Date("2026-04-01"), removalReason: "Keep reason" } });
  return { db, url: url.toString(), file };
}
async function snapshot(db: PrismaClient) {
  return {
    users: await db.$queryRawUnsafe('SELECT id,name,email,"isActive","createdAt","updatedAt" FROM "RequesterUser" ORDER BY id'),
    tickets: await db.ticket.findMany({ orderBy: { id: "asc" } }),
    attachments: await db.attachment.findMany({ orderBy: { id: "asc" } }),
  };
}
describe("MIG-01/02/04 preserved migration and create-only seeds", () => {
  afterAll(async () => { await Promise.all(clients.map(db => db.$disconnect())); });
  it("upgrades populated Lab 2 without changing IDs, values, relationships or bytes; reruns preserve hashes", async () => {
    const { db, url, file } = await legacy(), before = await snapshot(db);
    const digest = createHash("sha256").update(await readFile(file)).digest("hex");
    const credentials: Parameters<Handover>[0] = [];
    await migrateAuth(url, async values => { credentials.push(...values); });
    expect(await snapshot(db)).toEqual(before);
    expect(createHash("sha256").update(await readFile(file)).digest("hex")).toBe(digest);
    const users = await db.user.findMany({ orderBy: { id: "asc" } });
    expect(credentials).toHaveLength(3);
    for (const u of users) {
      expect(u.role).toBe("REQUESTER"); expect(u.mustChangePassword).toBe(true);
      expect(u.passwordHash).toMatch(/^\$argon2id\$/);
      expect(await verifyPassword(u.passwordHash, credentials.find(c => c.id === u.id)!.initialPassword)).toBe(true);
    }
    let repeated = false;
    await migrateAuth(url, async () => { repeated = true; });
    expect(repeated).toBe(false);
    expect(await db.user.findMany({ orderBy: { id: "asc" } })).toEqual(users);
    const created = await db.user.create({ data: { name: "Next", email: "next@example.com", emailNormalized: "next@example.com", passwordHash: users[0].passwordHash } });
    expect(created.id).toBeGreaterThan(3);
    await expect(db.$executeRawUnsafe(`UPDATE "RequesterUser" SET "passwordHash" = NULL WHERE id = 1`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE "RequesterUser" SET "emailNormalized" = NULL WHERE id = 1`)).rejects.toThrow();
  });
  it("stops normalized collisions before expansion without merging or dropping any legacy rows", async () => {
    const { db, url } = await legacy();
    await db.$executeRawUnsafe(`UPDATE "RequesterUser" SET email = ' Jennifer.Anderson@Example.com ' WHERE id = 2`);
    const before = await snapshot(db);
    await expect(migrateAuth(url, async () => {})).rejects.toThrow(/collision/i);
    expect(await snapshot(db)).toEqual(before);
    const columns = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'RequesterUser' AND column_name = 'passwordHash'`);
    expect(Number(columns[0].count)).toBe(0);
  });
  it("leaves unprovisioned rows unusable and enforces credentials only after provisioning", async () => {
    const { db, url } = await legacy();
    await deployThrough(url, "20260915000100_auth_expand");
    const missing = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) FROM "RequesterUser" WHERE "passwordHash" IS NULL`);
    expect(Number(missing[0].count)).toBe(3);
    await expect(db.user.findFirst()).rejects.toThrow(); // final model requires a hash
    const app = express(), auth = createAuth({ db: () => db, config: { origin: "http://localhost:5173", secure: false } });
    app.use(express.json(), auth.load); app.use("/api/auth", auth.router); app.use(authErrorHandler);
    const browser = request.agent(app), bootstrap = await browser.get("/api/auth/csrf").expect(200);
    const denied = await browser.post("/api/auth/login").set("Origin", "http://localhost:5173")
      .set("X-CSRF-Token", bootstrap.body.csrfToken)
      .send({ email: "jennifer.anderson@example.com", password: "Dummy credential for verification only!" }).expect(401);
    expect(denied.body.code).toBe("INVALID_CREDENTIALS");
    expect(await db.session.count({ where: { userId: { not: null } } })).toBe(0);
    await migrateAuth(url, async () => {});
    expect(await db.user.count()).toBe(3);
  });
  it("seeds twice without resetting changed roles, passwords, activation, tickets or removal metadata", async () => {
    const { db, url } = await legacy();
    await migrateAuth(url, async () => {});
    await seedLab3(db, async () => {});
    expect(await db.user.count({ where: { role: "IT_STAFF", isActive: true } })).toBe(3);
    expect(await db.user.count({ where: { role: "ADMINISTRATOR", isActive: true } })).toBe(1);
    await db.user.update({ where: { email: "jennifer.anderson@example.com" }, data: { name: "Edited", role: "IT_STAFF", isActive: false, mustChangePassword: false } });
    await db.ticket.update({ where: { ticketNumber: "TKT-2026-000101" }, data: { summary: "Human edit", currentStatus: "CLOSED" } });
    const attachment = await db.attachment.findFirstOrThrow({ where: { fileName: "battery_report.pdf" } });
    await db.attachment.update({ where: { id: attachment.id }, data: { isRemoved: true, removalReason: "Human choice", removedAt: new Date() } });
    const before = await snapshot(db), users = await db.user.findMany({ orderBy: { id: "asc" } });
    let handed = false;
    await seedLab3(db, async () => { handed = true; });
    expect(handed).toBe(false); expect(await snapshot(db)).toEqual(before);
    expect(await db.user.findMany({ orderBy: { id: "asc" } })).toEqual(users);
  });
});
