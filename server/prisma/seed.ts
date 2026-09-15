import { PrismaClient, UserRole } from "@prisma/client";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword, normalizeEmail } from "../src/auth/password.js";
import { terminalHandover, type Handover } from "../scripts/migrate-auth.js";
import { getPrisma } from "../src/prisma.js";

export async function seedLab3(prisma: PrismaClient, handover: Handover) {
  const credentials: Parameters<Handover>[0] = [];


  // 1. Seed Categories (4 required categories)
  const categories = [
    { name: "Account and Access", isActive: true },
    { name: "Hardware", isActive: true },
    { name: "Software", isActive: true },
    { name: "Network", isActive: true },
  ];

  const categoryMap = new Map<string, number>();
  for (const cat of categories) {
    const record = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    categoryMap.set(record.name, record.id);
  }


  // 2. Seed Related Systems (7 systems)
  const relatedSystems = [
    { name: "Email", isActive: true },
    { name: "Campus Wi-Fi", isActive: true },
    { name: "VPN", isActive: true },
    { name: "LEB2 App", isActive: true },
    { name: "Grade Submission App", isActive: true },
    { name: "Printer", isActive: true },
    { name: "Corporate Laptop", isActive: true },
  ];

  const systemMap = new Map<string, number>();
  for (const sys of relatedSystems) {
    const record = await prisma.relatedSystem.upsert({
      where: { name: sys.name },
      update: {},
      create: sys,
    });
    systemMap.set(record.name, record.id);
  }


  // 3. Seed Development Requesters (4 active, 1 inactive)
  const requesters = [
    {
      name: "Jennifer Anderson",
      email: "jennifer.anderson@example.com",
      isActive: true,
    },
    {
      name: "Michael Brown",
      email: "michael.brown@example.com",
      isActive: true,
    },
    {
      name: "David Lee",
      email: "david.lee@example.com",
      isActive: true,
    },
    {
      name: "Sarah Johnson",
      email: "sarah.johnson@example.com",
      isActive: true,
    },
    {
      name: "Robert Taylor",
      email: "robert.taylor@example.com",
      isActive: false,
    },
  ];

  const identities = [
    ...requesters.map(r => ({ ...r, role: UserRole.REQUESTER })),
    ...["Alex Morgan", "Casey Parker", "Jamie Reed", "Inactive Staff"].map((name, i) => ({
      name, email: "staff" + (i + 1) + "@example.com", isActive: i < 3, role: UserRole.IT_STAFF
    })),
    { name: "Local Administrator", email: "admin@example.com", isActive: true, role: UserRole.ADMINISTRATOR },
  ];
  const requesterMap = new Map<string, number>();
  for (const identity of identities) {
    const emailNormalized = normalizeEmail(identity.email);
    let record = await prisma.user.findUnique({ where: { emailNormalized } });
    if (!record) {
      const initialPassword = randomBytes(24).toString("base64url");
      record = await prisma.user.create({ data: { ...identity, emailNormalized,
        passwordHash: await hashPassword(initialPassword), mustChangePassword: true } });
      credentials.push({ id: record.id, email: record.email, initialPassword });
    }
    requesterMap.set(identity.email, record.id);
  }

  // 4. Seed Sample Tickets
  const jenniferId = requesterMap.get("jennifer.anderson@example.com")!;
  const michaelId = requesterMap.get("michael.brown@example.com")!;

  const sampleTickets = [
    {
      ticketNumber: "TKT-2026-000101",
      summary: "Laptop battery drains quickly after Windows update",
      description:
        "My laptop battery is draining much faster than usual even when idle. Started happening after last week's Windows update.",
      requestedPriority: "MEDIUM" as const,
      itPriority: "MEDIUM" as const,
      currentStatus: "NEW" as const,
      requesterId: jenniferId,
      categoryId: categoryMap.get("Hardware")!,
      relatedSystemId: systemMap.get("Corporate Laptop")!,
    },
    {
      ticketNumber: "TKT-2026-000102",
      summary: "Cannot connect to Campus Wi-Fi in building 3",
      description:
        "Authentication fails when connecting to KMUTT-Secure in building 3 floor 4.",
      requestedPriority: "HIGH" as const,
      itPriority: "HIGH" as const,
      currentStatus: "OPEN" as const,
      requesterId: jenniferId,
      categoryId: categoryMap.get("Network")!,
      relatedSystemId: systemMap.get("Campus Wi-Fi")!,
    },
    {
      ticketNumber: "TKT-2026-000103",
      summary: "VPN access expired for remote work",
      description:
        "Please renew my VPN certificate for remote access from home.",
      requestedPriority: "LOW" as const,
      itPriority: "LOW" as const,
      currentStatus: "RESOLVED" as const,
      requesterId: jenniferId,
      categoryId: categoryMap.get("Account and Access")!,
      relatedSystemId: systemMap.get("VPN")!,
    },
    {
      ticketNumber: "TKT-2026-000104",
      summary: "LEB2 App shows blank white screen on quiz submission",
      description:
        "Encountered blank page when submitting quiz 2 in LEB2 application.",
      requestedPriority: "CRITICAL" as const,
      itPriority: "HIGH" as const,
      currentStatus: "IN_PROGRESS" as const,
      requesterId: michaelId,
      categoryId: categoryMap.get("Software")!,
      relatedSystemId: systemMap.get("LEB2 App")!,
    },
    {
      ticketNumber: "TKT-2026-000105",
      summary: "Department printer paper jam error light",
      description:
        "Printer in Room 502 shows solid orange error light for paper jam.",
      requestedPriority: "MEDIUM" as const,
      itPriority: "LOW" as const,
      currentStatus: "OPEN" as const,
      requesterId: michaelId,
      categoryId: categoryMap.get("Hardware")!,
      relatedSystemId: systemMap.get("Printer")!,
    },
  ];

  const ticketMap = new Map<string, number>();
  for (const t of sampleTickets) {
    const record = await prisma.ticket.upsert({
      where: { ticketNumber: t.ticketNumber },
      update: {},
      create: t,
    });
    ticketMap.set(record.ticketNumber, record.id);
  }


  // 5. Seed Sample Attachments (for TKT-2026-000101)
  const ticket101Id = ticketMap.get("TKT-2026-000101")!;
  const sampleAttachments = [
    {
      fileName: "battery_report.pdf",
      storedPath: "uploads/lab-02/seed-battery-report.pdf",
      fileSize: 1048576,
      mimeType: "application/pdf",
      isRemoved: false,
      removedAt: null,
      removalReason: null,
    },
    {
      fileName: "wrong_screenshot.png",
      storedPath: "uploads/lab-02/seed-wrong-screenshot.png",
      fileSize: 524288,
      mimeType: "image/png",
      isRemoved: true,
      removedAt: new Date("2026-08-30T03:10:00.000Z"),
      removalReason: "Uploaded accidentally, contained private information",
    },
  ];

  for (const att of sampleAttachments) {
    const existing = await prisma.attachment.findFirst({
      where: {
        ticketId: ticket101Id,
        fileName: att.fileName,
      },
    });

    if (!existing) {
      await prisma.attachment.create({
        data: {
          ticketId: ticket101Id,
          ...att,
        },
      });
    }
  }


  if (credentials.length) await handover(credentials);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.stdout.isTTY || !process.env.DATABASE_URL) {
    console.error("Use a private interactive terminal and explicit DATABASE_URL; never redirect initial passwords.");
    process.exitCode = 1;
  } else {
    seedLab3(getPrisma(), terminalHandover)
      .then(() => console.log("Create-only seed complete. Existing accounts and records were preserved."))
      .catch(() => { console.error("Seed failed; no existing credentials were reset."); process.exitCode = 1; })
      .finally(() => getPrisma().$disconnect());
  }
}
