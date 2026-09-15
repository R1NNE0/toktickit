import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, writeFile, readdir, mkdir, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { hashPassword, normalizeEmail } from "../src/auth/password.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const finalMigration = "20260915000200_auth_required_credentials";
export type Handover = (credentials: { id: number; email: string; initialPassword: string }[]) => Promise<void>;
export async function provisionUsers(db: PrismaClient, handover: Handover) {
  // Raw projection deliberately tolerates temporary NULL hashes before final constraints.
  const users = await db.$queryRaw<{ id: number; email: string; emailNormalized: string | null; passwordHash: string | null }[]>
    `SELECT id, email, "emailNormalized", "passwordHash" FROM "RequesterUser" ORDER BY id`;
  const normalized = users.map(u => normalizeEmail(u.email));
  if (new Set(normalized).size !== users.length) throw new Error("Normalized email collision; provisioning stopped without changing accounts.");
  const credentials: Parameters<Handover>[0] = [];
  for (const user of users) {
    if (user.passwordHash) continue;
    const initialPassword = randomBytes(24).toString("base64url");
    const hash = await hashPassword(initialPassword);
    const changed = await db.$executeRaw`UPDATE "RequesterUser" SET "passwordHash" = ${hash},
      "emailNormalized" = ${normalizeEmail(user.email)}, "mustChangePassword" = true
      WHERE id = ${user.id} AND "passwordHash" IS NULL`;
    if (changed) credentials.push({ id: user.id, email: user.email, initialPassword });
  }
  // Only the explicit local operator channel receives plaintext, never SQL/logs/files.
  // Failure here requires an explicit later reset, not password regeneration on rerun.
  if (credentials.length) await handover(credentials);
}
export async function deployThrough(databaseUrl: string, through?: string) {
  const temp = await mkdtemp(path.join(tmpdir(), "toktickit-auth-migrations-"));
  try {
    await writeFile(path.join(temp, "schema.prisma"), await readFile(path.join(root, "prisma/schema.prisma")));
    await mkdir(path.join(temp, "migrations"));
    for (const entry of await readdir(path.join(root, "prisma/migrations"))) {
      if (entry === "migration_lock.toml" || !through || entry <= through)
        await cp(path.join(root, "prisma/migrations", entry), path.join(temp, "migrations", entry), { recursive: true });
    }
    execFileSync(process.execPath, [path.join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", path.join(temp, "schema.prisma")],
      { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" });
  } catch {
    throw new Error("Migration deploy failed. Check migration status and legacy normalized-email collisions; no data reset was attempted.");
  } finally {
    const resolved = path.resolve(temp);
    if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith("toktickit-auth-migrations-"))
      throw new Error("Unsafe temporary migration path.");
    await rm(resolved, { recursive: true, force: true });
  }
}
export async function migrateAuth(databaseUrl: string, handover: Handover) {
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    // Preflight before applying anything, including the expansion migration.
    const exists = await db.$queryRaw<{ exists: boolean }[]>`SELECT to_regclass('"RequesterUser"') IS NOT NULL AS exists`;
    if (exists[0].exists) {
      const rows = await db.$queryRaw<{ email: string }[]>`SELECT email FROM "RequesterUser"`;
      const keys = rows.map(r => normalizeEmail(r.email));
      if (new Set(keys).size !== rows.length) throw new Error("Normalized email collision; migration stopped without changing data.");
    }
    await deployThrough(databaseUrl, "20260915000100_auth_expand");
    await provisionUsers(db, handover);
    await deployThrough(databaseUrl, finalMigration);
  } finally { await db.$disconnect(); }
}
export const terminalHandover: Handover = async credentials => {
  if (!process.stdout.isTTY) throw new Error("Initial passwords require a private interactive terminal; redirected output is forbidden.");
  for (const value of credentials) process.stdout.write(JSON.stringify(value) + "\n");
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.stdout.isTTY || !process.env.DATABASE_URL) {
    console.error("Use a private interactive terminal with an explicit DATABASE_URL. Initial credentials are shown once; do not log or commit them.");
    process.exitCode = 1;
  } else {
    migrateAuth(process.env.DATABASE_URL, terminalHandover)
      .then(() => console.log("Authentication migration and provisioning complete."))
      .catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}
