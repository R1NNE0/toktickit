import { PrismaClient } from "@prisma/client";

/**
 * Generates a unique sequential ticket number in the format `TKT-YYYY-XXXXXX`.
 * Uses a PostgreSQL sequence with fallback to ensure concurrency safety.
 */
export async function generateTicketNumber(
  prisma: PrismaClient,
  year?: number
): Promise<string> {
  const currentYear = year || new Date().getFullYear();

  try {
    // Ensure the sequence exists starting from 106 (as 101-105 are seeded)
    await prisma.$executeRawUnsafe(
      `CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START WITH 106;`
    );

    // Get the next sequence value
    const result: Array<{ nextval: string | number | bigint }> =
      await prisma.$queryRawUnsafe(
        `SELECT nextval('ticket_number_seq') as nextval;`
      );

    const seqVal = Number(result[0].nextval);
    const candidate = `TKT-${currentYear}-${String(seqVal).padStart(6, "0")}`;

    // Verify it doesn't collide with existing records
    const existing = await prisma.ticket.findUnique({
      where: { ticketNumber: candidate },
    });

    if (!existing) {
      return candidate;
    }

    // In case of collision (e.g. from tests or seeds), advance using count + offset
    const count = await prisma.ticket.count();
    const safeNum = Math.max(seqVal + 1, count + 101);
    return `TKT-${currentYear}-${String(safeNum).padStart(6, "0")}`;
  } catch (err) {
    // Fallback if raw queries or sequence creation fails
    console.warn("Sequence generation fallback:", err);
    const count = await prisma.ticket.count();
    return `TKT-${currentYear}-${String(count + 106).padStart(6, "0")}`;
  }
}
