import { PrismaClient } from "@prisma/client";
import { assertTestEnvironment } from "./safety.js";
import { migrateAuth } from "../../scripts/migrate-auth.js";
import { seedLab3 } from "../../prisma/seed.js";
export default async function setup() {
  assertTestEnvironment();
  const db = new PrismaClient();
  try {
    // Destructive setup is confined to the positively identified disposable database.
    await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await db.$executeRawUnsafe('CREATE SCHEMA public');
    await migrateAuth(process.env.DATABASE_URL!, async () => {});
    await seedLab3(db, async () => {});
    // Historical business suites start after the mandatory change; auth suites exercise it separately.
    await db.user.updateMany({ data: { mustChangePassword: false } });
  } finally { await db.$disconnect(); }
}
