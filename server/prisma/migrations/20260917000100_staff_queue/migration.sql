-- Additive queue support: existing tickets remain unassigned and keep all values.
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_FOR_REQUESTER' BEFORE 'RESOLVED';
ALTER TYPE "TicketStatus" ADD VALUE 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE 'CANCELLED';
ALTER TABLE "Ticket" ADD COLUMN "ownerId" INTEGER;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "RequesterUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
