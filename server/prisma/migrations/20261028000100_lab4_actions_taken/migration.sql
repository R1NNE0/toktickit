-- Additive only: existing rows, statuses, timestamps and credentials stay intact.
-- The transaction makes a failed DDL statement roll back the whole increment.
BEGIN;

CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ActionRevisionOperation" AS ENUM ('CREATE', 'EDIT', 'REASSIGN', 'START', 'COMPLETE', 'CANCEL');

ALTER TABLE "Ticket"
  ADD COLUMN "workflowVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "workCycle" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "resolvedAt" TIMESTAMPTZ(3),
  ADD CONSTRAINT "Ticket_workflowVersion_positive" CHECK ("workflowVersion" > 0),
  ADD CONSTRAINT "Ticket_workCycle_positive" CHECK ("workCycle" > 0);

CREATE TABLE "ActionTaken" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "cycle" INTEGER NOT NULL,
  "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
  "description" TEXT NOT NULL,
  "result" TEXT,
  "assigneeId" INTEGER NOT NULL,
  "createdById" INTEGER NOT NULL,
  "performedById" INTEGER,
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "followUpNote" TEXT,
  "attachmentNotes" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "completedAt" TIMESTAMPTZ(3),
  "cancelledAt" TIMESTAMPTZ(3),
  "cancellationReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "clientRequestId" UUID NOT NULL,
  "createRequestHash" CHAR(64) NOT NULL,
  CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActionTaken_cycle_positive" CHECK ("cycle" > 0),
  CONSTRAINT "ActionTaken_version_positive" CHECK ("version" > 0),
  CONSTRAINT "ActionTaken_description_length" CHECK (char_length(btrim("description", U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) BETWEEN 1 AND 4000),
  CONSTRAINT "ActionTaken_result_length" CHECK ("result" IS NULL OR char_length(btrim("result", U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) BETWEEN 1 AND 4000),
  CONSTRAINT "ActionTaken_followUpNote_length" CHECK ("followUpNote" IS NULL OR char_length(btrim("followUpNote", U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) BETWEEN 1 AND 2000),
  CONSTRAINT "ActionTaken_attachmentNotes_length" CHECK ("attachmentNotes" IS NULL OR char_length(btrim("attachmentNotes", U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) BETWEEN 1 AND 2000),
  CONSTRAINT "ActionTaken_cancellationReason_length" CHECK ("cancellationReason" IS NULL OR char_length(btrim("cancellationReason", U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) BETWEEN 1 AND 4000),
  CONSTRAINT "ActionTaken_followUp_consistency" CHECK (NOT "followUpRequired" OR "followUpNote" IS NOT NULL),
  CONSTRAINT "ActionTaken_hash_format" CHECK ("createRequestHash" ~ '^[0-9a-f]{64}$'),
  -- Explicit NULL guards prevent SQL UNKNOWN from passing conditional checks.
  CONSTRAINT "ActionTaken_lifecycle_consistency" CHECK (
    ("status" = 'COMPLETED' AND "result" IS NOT NULL AND "performedById" IS NOT NULL
      AND "performedById" = "assigneeId" AND "completedAt" IS NOT NULL
      AND "cancelledAt" IS NULL AND "cancellationReason" IS NULL)
    OR ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "cancellationReason" IS NOT NULL
      AND "performedById" IS NULL AND "completedAt" IS NULL)
    OR ("status" IN ('PLANNED', 'IN_PROGRESS') AND "performedById" IS NULL
      AND "completedAt" IS NULL AND "cancelledAt" IS NULL AND "cancellationReason" IS NULL)
  )
);

CREATE TABLE "ActionTakenRevision" (
  "id" SERIAL NOT NULL,
  "actionId" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "operation" "ActionRevisionOperation" NOT NULL,
  "actorId" INTEGER NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changeReason" TEXT,
  "snapshot" JSONB NOT NULL,
  CONSTRAINT "ActionTakenRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActionTakenRevision_version_positive" CHECK ("version" > 0),
  CONSTRAINT "ActionTakenRevision_changeReason_length" CHECK ("changeReason" IS NULL OR char_length(btrim("changeReason", U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) BETWEEN 1 AND 4000)
);

CREATE UNIQUE INDEX "ActionTaken_createdById_clientRequestId_key" ON "ActionTaken"("createdById", "clientRequestId");
CREATE UNIQUE INDEX "ActionTakenRevision_actionId_version_key" ON "ActionTakenRevision"("actionId", "version");
CREATE INDEX "ActionTaken_ticketId_cycle_createdAt_id_idx" ON "ActionTaken"("ticketId", "cycle", "createdAt", "id");
CREATE INDEX "ActionTaken_ticketId_cycle_status_idx" ON "ActionTaken"("ticketId", "cycle", "status");
CREATE INDEX "ActionTaken_assigneeId_status_ticketId_idx" ON "ActionTaken"("assigneeId", "status", "ticketId");
CREATE INDEX "Ticket_ownerId_currentStatus_idx" ON "Ticket"("ownerId", "currentStatus");
CREATE INDEX "Ticket_currentStatus_itPriority_idx" ON "Ticket"("currentStatus", "itPriority");
CREATE INDEX "Ticket_updatedAt_id_idx" ON "Ticket"("updatedAt", "id");
CREATE INDEX "Ticket_requesterId_updatedAt_id_idx" ON "Ticket"("requesterId", "updatedAt", "id");
CREATE INDEX "Ticket_requesterId_resolvedAt_id_idx" ON "Ticket"("requesterId", "resolvedAt", "id");

ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "RequesterUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "RequesterUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey"
  FOREIGN KEY ("performedById") REFERENCES "RequesterUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTakenRevision" ADD CONSTRAINT "ActionTakenRevision_actionId_fkey"
  FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTakenRevision" ADD CONSTRAINT "ActionTakenRevision_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "RequesterUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
