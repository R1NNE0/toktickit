import type { ActionTaken, Prisma, PrismaClient, TicketStatus, User } from "@prisma/client";
import { parseCreateAction, creationFingerprint } from "../src/actionValidation.js";
import { planCreateAction, planActionTransition, type ActionPlan, type ActionStatus } from "../src/actionWorkflow.js";
import { lockEligibility, lockTicket } from "../src/ticketConcurrency.js";

// New demonstration graphs only: never backfill Actions onto historical Lab 3 Tickets.
// Dates/UUIDs are deterministic so reruns can report divergence without repairing it.
type Identity = "requester" | "other" | "staff" | "colleague" | "inactive" | "admin";
const emails: Record<Identity, string> = { requester: "jennifer.anderson@example.com", other: "michael.brown@example.com",
  staff: "staff1@example.com", colleague: "staff2@example.com", inactive: "staff4@example.com", admin: "admin@example.com" };
type Work = { state: ActionStatus; assignee: Identity; cycle?: number; followUp?: boolean };
type Fixture = { status: TicketStatus; summary: string; owner: Identity | null; actions: Work[] };
const fixtures: Fixture[] = [
  { status: "NEW", summary: "Awaiting triage, no Actions", owner: null, actions: [] },
  { status: "OPEN", summary: "One planned diagnostic, different owner and assignee", owner: "staff", actions: [{ state: "PLANNED", assignee: "colleague" }] },
  { status: "IN_PROGRESS", summary: "Parallel diagnostics and an abandoned approach", owner: "colleague", actions: [
    { state: "PLANNED", assignee: "staff" }, { state: "IN_PROGRESS", assignee: "colleague" }, { state: "CANCELLED", assignee: "staff" }] },
  { status: "WAITING_FOR_REQUESTER", summary: "Completed repair awaiting follow-up", owner: "staff", actions: [
    { state: "COMPLETED", assignee: "colleague", followUp: true }, { state: "COMPLETED", assignee: "staff" }] },
  { status: "RESOLVED", summary: "Verified resolution with an Administrator owner", owner: "admin", actions: [{ state: "COMPLETED", assignee: "colleague" }] },
  { status: "CLOSED", summary: "Closed after verified resolution", owner: "colleague", actions: [{ state: "COMPLETED", assignee: "staff" }] },
  { status: "REOPENED", summary: "Recurring issue with preserved first-cycle history", owner: "staff", actions: [
    { state: "COMPLETED", assignee: "colleague", cycle: 1 }, { state: "PLANNED", assignee: "staff", cycle: 2 }, { state: "IN_PROGRESS", assignee: "colleague", cycle: 2 }] },
  { status: "CANCELLED", summary: "Withdrawn request with explicitly cancelled work", owner: null, actions: [{ state: "CANCELLED", assignee: "staff" }] },
  { status: "OPEN", summary: "Work assigned before Staff deactivation; reassignment needed", owner: "colleague", actions: [{ state: "IN_PROGRESS", assignee: "inactive" }] },
];
type People = Record<Identity, User>;
type PlannedWork = { key: string; hash: string; steps: { plan: ActionPlan; actorId: number }[] };
const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const statusSteps: Record<TicketStatus, number> = { NEW: 0, OPEN: 1, IN_PROGRESS: 2, WAITING_FOR_REQUESTER: 3, RESOLVED: 3, CLOSED: 4, REOPENED: 4, CANCELLED: 1 };

function graph(index: number, ticketId: number, people: People, categoryId: number, relatedSystemId: number) {
  const spec = fixtures[index], number = "L4-DEMO-" + String(index + 1).padStart(3, "0");
  const at = (minute: number) => new Date(Date.UTC(2026, 9, 15 + index, 8, minute));
  let workflowVersion = 1;
  const actions: PlannedWork[] = spec.actions.map((work, actionIndex) => {
    const key = `4c504534-0000-4000-8000-${String((index + 1) * 100 + actionIndex + 1).padStart(12, "0")}`;
    const cycle = work.cycle ?? 1, minute = (cycle - 1) * 120 + actionIndex * 10 + 1;
    // This fixture models assignment/start BEFORE deactivation. It never activates
    // or rewrites the actual account. Current API operations still reject that assignee.
    const assignee = work.assignee === "inactive" ? { ...people.inactive, isActive: true } : people[work.assignee];
    const input = parseCreateAction({ clientRequestId: key, expectedWorkflowVersion: workflowVersion,
      description: `${number}: ${work.assignee === "inactive" ? "Diagnostic started before account deactivation" : "Diagnostic task " + (actionIndex + 1)}`,
      assigneeId: assignee.id, attachmentNotes: "Service checklist reviewed; no additional file attached." }, people.admin.id);
    const parent = { id: ticketId, currentStatus: "IN_PROGRESS", workCycle: cycle, workflowVersion };
    let plan = planCreateAction(input, { actor: people.admin, assignee, parent, now: at(minute) });
    const steps = [{ plan, actorId: people.admin.id }]; workflowVersion++;
    if (["IN_PROGRESS", "COMPLETED"].includes(work.state)) {
      plan = planActionTransition(plan.action, { targetStatus: "IN_PROGRESS", expectedVersion: plan.action.version, expectedWorkflowVersion: workflowVersion },
        { actor: assignee, assignee, parent: { ...parent, workflowVersion }, now: at(minute + 1) });
      steps.push({ plan, actorId: assignee.id }); workflowVersion++;
    }
    if (work.state === "COMPLETED") {
      plan = planActionTransition(plan.action, { targetStatus: "COMPLETED", expectedVersion: plan.action.version, expectedWorkflowVersion: workflowVersion,
        result: "Repair verified with a successful diagnostic.", followUpRequired: !!work.followUp,
        followUpNote: work.followUp ? "Ask the Requester to confirm after the next working session." : null },
      { actor: assignee, assignee, parent: { ...parent, workflowVersion }, now: at(minute + 2) });
      steps.push({ plan, actorId: assignee.id }); workflowVersion++;
    } else if (work.state === "CANCELLED") {
      plan = planActionTransition(plan.action, { targetStatus: "CANCELLED", expectedVersion: plan.action.version, expectedWorkflowVersion: workflowVersion,
        confirmed: true, reason: "Alternative approach selected; this task is no longer needed." },
      { actor: people.admin, assignee, parent: { ...parent, workflowVersion }, now: at(minute + 1) });
      steps.push({ plan, actorId: people.admin.id }); workflowVersion++;
    }
    return { key, hash: creationFingerprint(ticketId, input), steps };
  });
  const data = { ticketNumber: number, summary: spec.summary, description: "Lab 4 demonstration: " + spec.summary,
    requesterId: (index % 2 ? people.other : people.requester).id, ownerId: spec.owner ? people[spec.owner].id : null,
    categoryId, relatedSystemId, requestedPriority: priorities[index % 4], itPriority: priorities[(index + 1) % 4],
    currentStatus: spec.status, workCycle: spec.status === "REOPENED" ? 2 : 1,
    workflowVersion: workflowVersion + statusSteps[spec.status],
    createdAt: at(0), updatedAt: at(200), resolvedAt: ["RESOLVED", "CLOSED"].includes(spec.status) ? at(90) : null,
    resolutionSuggestedAt: null, resolutionSuggestedById: null } satisfies Prisma.TicketUncheckedCreateInput;
  const comments = ["REOPENED", "CANCELLED"].includes(spec.status) ? [{ authorId: people.staff.id, createdAt: at(100),
    body: spec.status === "REOPENED" ? "Issue returned after verification; opening a new work cycle." : "Requester withdrew the request after all unfinished tasks were cancelled." }] : [];
  return { data, actions, comments };
}
function snapshot(id: number, action: ActionPlan["action"]): Prisma.InputJsonObject {
  // Match the API's public scalar snapshot; omit creation keys/hashes and user secrets.
  return JSON.parse(JSON.stringify({ id, ...action }));
}
function matches(record: object, expected: object): boolean {
  return Object.entries(expected).every(([key, value]) => JSON.stringify((record as Record<string, unknown>)[key]) === JSON.stringify(value));
}
const include = { actionsTaken: { include: { revisions: { orderBy: { version: "asc" as const } } } },
  publicComments: true, internalNotes: { select: { id: true } }, attachments: { select: { id: true } } } satisfies Prisma.TicketInclude;
type StoredGraph = Prisma.TicketGetPayload<{ include: typeof include }>;
function unchanged(current: StoredGraph, expected: ReturnType<typeof graph>) {
  if (!matches(current, expected.data) || current.actionsTaken.length !== expected.actions.length || current.attachments.length || current.internalNotes.length
    || current.publicComments.length !== expected.comments.length) return false;
  if (!expected.comments.every(comment => current.publicComments.some(row => matches(row, comment)))) return false;
  return expected.actions.every(work => {
    const action = current.actionsTaken.find(a => a.clientRequestId === work.key);
    if (!action || !matches(action, { ...work.steps.at(-1)!.plan.action, createRequestHash: work.hash }) || action.revisions.length !== work.steps.length) return false;
    return work.steps.every(({ plan, actorId }, i) => {
      const revision = action.revisions[i];
      // JSONB key order is not significant: compare snapshot fields, not stringified objects.
      return matches(revision, { version: plan.action.version, operation: plan.operation, actorId, occurredAt: plan.action.updatedAt, changeReason: plan.changeReason })
        && matches(revision.snapshot as object, snapshot(action.id, plan.action));
    });
  });
}

export type Lab4SeedReport = { created: string[]; retained: string[]; changed: string[]; unavailable: string[] };
export async function seedLab4Fixtures(db: PrismaClient): Promise<Lab4SeedReport> {
  const report: Lab4SeedReport = { created: [], retained: [], changed: [], unavailable: [] };
  for (let index = 0; index < fixtures.length; index++) {
    const number = "L4-DEMO-" + String(index + 1).padStart(3, "0");
    const outcome = await db.$transaction(async tx => {
      // Same order as application writes; concurrent seed invocations serialize per graph.
      await lockEligibility(tx);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"lab4-seed:" + number}))`;
      let current = await tx.ticket.findUnique({ where: { ticketNumber: number }, include });
      if (current) { await lockTicket(tx, current.id); current = await tx.ticket.findUniqueOrThrow({ where: { id: current.id }, include }); }
      const people = {} as People;
      for (const [key, emailNormalized] of Object.entries(emails)) {
        const user = await tx.user.findUnique({ where: { emailNormalized } });
        if (!user) return current ? "changed" : "unavailable";
        people[key as Identity] = user;
      }
      const category = await tx.category.findUnique({ where: { name: "Hardware" } });
      const system = await tx.relatedSystem.findUnique({ where: { name: "Corporate Laptop" } });
      // Do not undo account/reference choices to force a demonstration scenario.
      const eligible = (user: User) => user.isActive && ["IT_STAFF", "ADMINISTRATOR"].includes(user.role);
      const dependenciesValid = eligible(people.staff) && eligible(people.colleague) && eligible(people.admin)
        && [people.requester, people.other].every(u => u.role === "REQUESTER" && u.isActive)
        && (index !== 8 || (people.inactive.role === "IT_STAFF" && !people.inactive.isActive));
      if (!category || !system || !dependenciesValid) return current ? "changed" : "unavailable";
      if (current) return unchanged(current, graph(index, current.id, people, category.id, system.id)) ? "retained" : "changed";
      if (!category.isActive || !system.isActive) return "unavailable";
      const draft = graph(index, 1, people, category.id, system.id);
      const ticket = await tx.ticket.create({ data: draft.data });
      const expected = graph(index, ticket.id, people, category.id, system.id);
      for (const work of expected.actions) {
        let action: ActionTaken | undefined;
        for (const { plan, actorId } of work.steps) {
          action = action ? await tx.actionTaken.update({ where: { id: action.id }, data: plan.action })
            : await tx.actionTaken.create({ data: { ...plan.action, clientRequestId: work.key, createRequestHash: work.hash } });
          await tx.actionTakenRevision.create({ data: { actionId: action.id, version: action.version, operation: plan.operation!, actorId,
            occurredAt: action.updatedAt, changeReason: plan.changeReason, snapshot: snapshot(action.id, plan.action) } });
        }
      }
      for (const comment of expected.comments) await tx.publicComment.create({ data: { ...comment, ticketId: ticket.id } });
      return "created";
    }, { timeout: 15000 });
    if (outcome === "changed") { report.retained.push(number); report.changed.push(number); }
    else report[outcome].push(number);
  }
  return report;
}
