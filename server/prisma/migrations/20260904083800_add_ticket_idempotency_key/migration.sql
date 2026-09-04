-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_requesterId_idempotencyKey_key" ON "Ticket"("requesterId", "idempotencyKey");
