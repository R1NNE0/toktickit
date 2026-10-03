-- Existing IDs, timestamps, sequences and Ticket foreign keys stay in place.
BEGIN;
CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');
ALTER TABLE "RequesterUser"
  ADD COLUMN "emailNormalized" TEXT,
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'REQUESTER',
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
DO $$
BEGIN
  IF EXISTS (SELECT lower(btrim(email)) FROM "RequesterUser"
             GROUP BY lower(btrim(email)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Normalized email collision: resolve legacy identities before retrying; no accounts were merged';
  END IF;
END $$;
UPDATE "RequesterUser" SET "emailNormalized" = lower(btrim(email));
CREATE UNIQUE INDEX "RequesterUser_emailNormalized_key" ON "RequesterUser"("emailNormalized");
CREATE TABLE "Session" (
  "tokenHash" TEXT NOT NULL PRIMARY KEY,
  "userId" INTEGER,
  "csrfToken" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RequesterUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
COMMIT;
