import { randomUUID } from "node:crypto";
import { getPrisma } from "../../src/prisma.js";
import { assertTestEnvironment } from "../lab-03/safety.js";
import { requesterHeaders } from "../lab-03/legacy-session.js";
import { statusOrder, priorityOrder } from "../../src/staffQueue.js";

export async function performanceFixture() {
  assertTestEnvironment();
  const db = getPrisma(), marker = "L4-PERF-" + randomUUID();
  const users: number[] = [], tickets: number[] = [];
  const to = new Date("2026-10-27T05:00:00Z"), from = new Date(+to - 168 * 3600000);
  const cleanup = async () => {
    await db.actionTakenRevision.deleteMany({ where: { action: { ticketId: { in: tickets } } } });
    await db.actionTaken.deleteMany({ where: { ticketId: { in: tickets } } });
    await db.ticket.deleteMany({ where: { id: { in: tickets } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
  };
  try {
    for (let i = 0; i < 10; i++) {
      const email = `${marker}-${i}@example.com`;
      const u = await db.user.create({ data: { name: `${marker}-${i}`, email, emailNormalized: email,
        role: i < 7 ? "REQUESTER" : i < 9 ? "IT_STAFF" : "ADMINISTRATOR", passwordHash: "test-only", mustChangePassword: false } }); users.push(u.id);
    }
    const category = await db.category.findFirstOrThrow(), system = await db.relatedSystem.findFirstOrThrow();
    const times = [new Date(+from - 1), from, new Date(+to - 1), to, new Date(+to + 1)];
    for (let i = 0; i < 300; i++) {
      const ticket = await db.ticket.create({ data: { ticketNumber: `${marker}-${i}`, summary: "Performance fixture", description: marker,
        requesterId: users[i % 6], ownerId: [null, users[7], users[8], users[9]][i % 4], categoryId: category.id, relatedSystemId: system.id,
        currentStatus: statusOrder[i % 8], requestedPriority: priorityOrder[(i + 1) % 4], itPriority: priorityOrder[i % 4],
        workCycle: i % 5 === 0 || statusOrder[i % 8] === "REOPENED" ? 2 : 1,
        updatedAt: times[i % 5], resolvedAt: ["RESOLVED", "CLOSED"].includes(statusOrder[i % 8]) && i % 3 !== 0 ? times[i % 5] : null } });
      tickets.push(ticket.id);
      await db.$transaction(async tx => {
        for (let j = 0; j < [0, 1, 8][i % 3]; j++) {
          const terminal = ["RESOLVED", "CLOSED", "CANCELLED"].includes(ticket.currentStatus);
          const states = terminal ? ["COMPLETED", "CANCELLED"] as const : ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
          const status = states[j % states.length], assigneeId = users[7 + ((i + j) % 3)], createdById = users[7 + ((i + j + 1) % 3)];
          const createdAt = new Date(+from - 86400000 + i * 1000 + j), startedAt = new Date(+createdAt + 100), finishedAt = new Date(+createdAt + 200);
          const version = status === "COMPLETED" ? 3 : status === "PLANNED" ? 1 : 2;
          const action = await tx.actionTaken.create({ data: { ticketId: ticket.id, cycle: ticket.workCycle === 2 && j === 0 ? 1 : ticket.workCycle,
            status, version, description: marker + " " + "Work ".repeat(45), assigneeId, createdById,
            clientRequestId: `00000000-0000-4000-8000-${String(i * 8 + j).padStart(12, "0")}`, createRequestHash: "0".repeat(64),
            createdAt, updatedAt: status === "PLANNED" ? createdAt : status === "IN_PROGRESS" ? startedAt : finishedAt,
            performedById: status === "COMPLETED" ? assigneeId : null, completedAt: status === "COMPLETED" ? finishedAt : null,
            result: status === "COMPLETED" ? "Verified work" : null,
            followUpRequired: !terminal && status === "COMPLETED" && i % 2 === 0,
            followUpNote: !terminal && status === "COMPLETED" && i % 2 === 0 ? "Verify with Requester" : null,
            cancelledAt: status === "CANCELLED" ? finishedAt : null, cancellationReason: status === "CANCELLED" ? "Superseded work" : null } });
          const base = { ...action, status: "PLANNED", version: 1, result: null, performedById: null, completedAt: null, cancelledAt: null,
            cancellationReason: null, followUpRequired: false, followUpNote: null, updatedAt: createdAt };
          const revision = (snapshot: object, version: number, operation: "CREATE" | "START" | "COMPLETE" | "CANCEL", actorId: number, occurredAt: Date) => {
            const { clientRequestId, createRequestHash, ...visible } = snapshot as Record<string, unknown>;
            return tx.actionTakenRevision.create({ data: { actionId: action.id, version, operation, actorId, occurredAt,
              changeReason: operation === "CANCEL" ? action.cancellationReason : null, snapshot: JSON.parse(JSON.stringify(visible)) } });
          };
          await revision(base, 1, "CREATE", createdById, createdAt);
          if (["IN_PROGRESS", "COMPLETED"].includes(status)) await revision({ ...base, status: "IN_PROGRESS", version: 2, updatedAt: startedAt }, 2, "START", assigneeId, startedAt);
          if (status === "COMPLETED") await revision(action, 3, "COMPLETE", assigneeId, finishedAt);
          if (status === "CANCELLED") await revision(action, 2, "CANCEL", createdById, finishedAt);
        }
      });
    }
    return { marker, users, tickets, to, from, cleanup, staffHeaders: await requesterHeaders(users[7]), adminHeaders: await requesterHeaders(users[9]),
      requesterHeaders: await requesterHeaders(users[0]), zeroHeaders: await requesterHeaders(users[6]) };
  } catch (error) { await cleanup(); throw error; }
}
