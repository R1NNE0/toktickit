-- scripts/migrate-auth.ts provisions hashes between these two migrations.
-- A direct deploy on unprovisioned legacy data fails safely, never inventing credentials.
BEGIN;
ALTER TABLE "RequesterUser" ALTER COLUMN "emailNormalized" SET NOT NULL;
ALTER TABLE "RequesterUser" ALTER COLUMN "passwordHash" SET NOT NULL;
COMMIT;
