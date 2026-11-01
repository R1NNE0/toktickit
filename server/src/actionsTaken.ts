import { outstandingPredicate } from "./dashboardQueries.js";
import { Router, type Request } from "express";
import { Prisma, type ActionTaken, type Ticket, type TicketStatus } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { HttpError, asyncRoute, requireNormal } from "./auth/http.js";
import { positiveId } from "./middleware/requesterInput.js";
import { ActionRuleError, parseCreateAction, parseEditAction, parseTransitionAction, creationFingerprint } from "./actionValidation.js";
import { planCreateAction, planEditAction, planActionTransition, type ActionPlan, type ActionRecord } from "./actionWorkflow.js";
import { retryTransaction, lockEligibility, lockTicket, liveActor, assertCanAdvance } from "./ticketConcurrency.js";

const staffRoles = ["IT_STAFF", "ADMINISTRATOR"] as const;
const userSelect = { id: true, name: true, role: true, isActive: true } as const;
const actionInclude = { assignee: { select: userSelect }, createdBy: { select: userSelect }, performedBy: { select: userSelect } } as const;
type ActionView = Prisma.ActionTakenGetPayload<{ include: typeof actionInclude }>;
const missing = (): never => { throw new HttpError(404, "NOT_FOUND", "Resource not found."); };
const invalidQuery = (): never => { throw new HttpError(400, "INVALID_QUERY", "Invalid Action query parameters."); };
function scalar(a: ActionTaken) {
  return { id: a.id, ticketId: a.ticketId, cycle: a.cycle, status: a.status, description: a.description,
    result: a.result, followUpRequired: a.followUpRequired, followUpNote: a.followUpNote, attachmentNotes: a.attachmentNotes,
    createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null, cancelledAt: a.cancelledAt?.toISOString() ?? null,
    cancellationReason: a.cancellationReason, version: a.version };
}
function dto(a: ActionView) { return { ...scalar(a), assignee: a.assignee, createdBy: a.createdBy, performedBy: a.performedBy }; }
function domainRecord(a: ActionTaken): ActionRecord {
  return { ticketId: a.ticketId, cycle: a.cycle, status: a.status, description: a.description, result: a.result,
    assigneeId: a.assigneeId, createdById: a.createdById, performedById: a.performedById,
    followUpRequired: a.followUpRequired, followUpNote: a.followUpNote, attachmentNotes: a.attachmentNotes,
    createdAt: a.createdAt, updatedAt: a.updatedAt, completedAt: a.completedAt, cancelledAt: a.cancelledAt,
    cancellationReason: a.cancellationReason, version: a.version };
}
function snapshot(a: ActionTaken) {
  return { ...scalar(a), assigneeId: a.assigneeId, createdById: a.createdById, performedById: a.performedById };
}
function workflowMeta(t: Ticket) {
  return { id: t.id, workflowVersion: t.workflowVersion, workCycle: t.workCycle, updatedAt: t.updatedAt.toISOString() };
}
function pagination(req: Request, allowed: string[]) {
  if (Object.keys(req.query).some(k => !allowed.includes(k) || typeof req.query[k] !== "string")) invalidQuery();
  const number = (value: unknown) => {
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || Number(value) > 2147483647) return invalidQuery();
    return Number(value);
  };
  const page = number(req.query.page ?? "1"), pageSize = number(req.query.pageSize ?? "20");
  if (![10,20,50].includes(pageSize) || (page - 1) * pageSize > 2147483647) invalidQuery();
  return { page, pageSize, skip: (page - 1) * pageSize,
    cycle: req.query.cycle === undefined ? undefined : number(req.query.cycle) };
}
function pageResult<T>(data: T[], totalItems: number, p: { page: number; pageSize: number }) {
  return { data, pagination: { page: p.page, pageSize: p.pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / p.pageSize)) } };
}
function noBody(req: Request) {
  if (req.body !== undefined && (req.body === null || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length))
    throw new HttpError(400, "VALIDATION_ERROR", "This operation does not accept a body.");
}
async function parentAccess(tx: Prisma.TransactionClient, ticketId: number, user: ReturnType<typeof requireNormal>) {
  const t = await tx.ticket.findUnique({ where: { id: ticketId } });
  if (!t || (user.role === "REQUESTER" && t.requesterId !== user.id)) return missing();
  return t;
}
async function childAccess(tx: Prisma.TransactionClient, ticketId: number, actionId: number) {
  const a = await tx.actionTaken.findUnique({ where: { id: actionId }, include: actionInclude });
  if (!a || a.ticketId !== ticketId) return missing();
  return a;
}
function mappedError(error: unknown, ticket?: Ticket, action?: ActionTaken): never {
  if (error instanceof ActionRuleError) {
    throw new HttpError(error.status, error.code, error.message, {
      ...(error.status === 409 && ticket ? { currentWorkflowVersion: ticket.workflowVersion,
        ...(action ? { currentActionVersion: action.version } : {}), currentCycle: ticket.workCycle } : {}),
      ...(error.fields ? { details: { fields: error.fields } } : {}),
    });
  }
  throw error;
}
async function mutate(req: Request, ticketId: number, actionId: number | undefined, operation: "create" | "edit" | "transition") {
  const actor = requireNormal(req);
  const create = operation === "create" ? parseCreateAction(req.body, actor.id) : undefined;
  const edit = operation === "edit" ? parseEditAction(req.body) : undefined;
  const transition = operation === "transition" ? parseTransitionAction(req.body) : undefined;
  const hash = create ? creationFingerprint(ticketId, create) : undefined;
  const execute = () => retryTransaction(async tx => {
    await lockEligibility(tx);
    const parent = await lockTicket(tx, ticketId);
    const currentActor = await liveActor(tx, req, staffRoles);
    let current: ActionView | undefined;
    if (actionId !== undefined) current = await childAccess(tx, ticketId, actionId);
    if (create) {
      const existing = await tx.actionTaken.findUnique({
        where: { createdById_clientRequestId: { createdById: currentActor.id, clientRequestId: create.clientRequestId } },
        include: actionInclude,
      });
      if (existing) {
        if (existing.createRequestHash !== hash) throw new HttpError(409, "IDEMPOTENCY_KEY_REUSED", "Creation key was already used for different content.");
        return { action: dto(existing), ticket: workflowMeta(parent), replayed: true };
      }
    }
    try {
      const assigneeId = create?.assigneeId ?? edit?.assigneeId ?? current!.assigneeId;
      const assignee = await tx.user.findUnique({ where: { id: assigneeId }, select: userSelect });
      const ctx = { actor: currentActor, assignee: assignee ?? undefined, parent, now: new Date() };
      const plan: ActionPlan = create ? planCreateAction(create, ctx)
        : edit ? planEditAction(domainRecord(current!), edit, ctx) : planActionTransition(domainRecord(current!), transition!, ctx);
      if (!plan.changed) return { action: dto(current!), ticket: workflowMeta(parent), replayed: false };
      assertCanAdvance(parent);
      const a = create
        ? await tx.actionTaken.create({ data: { ...plan.action, clientRequestId: create.clientRequestId, createRequestHash: hash! }, include: actionInclude })
        : await tx.actionTaken.update({ where: { id: current!.id }, data: plan.action, include: actionInclude });
      await tx.actionTakenRevision.create({ data: { actionId: a.id, version: a.version, operation: plan.operation!,
        actorId: currentActor.id, occurredAt: ctx.now, changeReason: plan.changeReason, snapshot: snapshot(a) } });
      const updated = await tx.ticket.update({ where: { id: ticketId }, data: { workflowVersion: { increment: 1 }, updatedAt: ctx.now } });
      return { action: dto(a), ticket: workflowMeta(updated), replayed: false };
    } catch (error) { return mappedError(error, parent, current); }
  });
  try { return await execute(); }
  catch (error) {
    // Different parent locks may race on the creator/UUID unique key. The failed
    // transaction has rolled back before the second transaction looks up replay.
    if (create && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
      && Array.isArray(error.meta?.target) && error.meta.target.includes("createdById") && error.meta.target.includes("clientRequestId"))
      return execute();
    throw error;
  }
}

export const actionsRouter = Router();
type Resource = "collection" | "item" | "history" | "transitions" | "outstanding";
function handler(resource: Resource) {
  return asyncRoute(async (req, res) => {
    const user = requireNormal(req);
    const privileged = resource === "history" || resource === "transitions" || resource === "outstanding" || req.method !== "GET";
    if (privileged && user.role === "REQUESTER") throw new HttpError(403, "FORBIDDEN", "This operation requires IT Staff or Administrator.");
    const ticketId = resource === "outstanding" ? undefined : positiveId(req.params.ticketId, "ticket");
    const actionId = req.params.actionId === undefined ? undefined : positiveId(req.params.actionId, "action");
    const operation = resource === "collection" && req.method === "POST" ? "create"
      : resource === "item" && req.method === "PATCH" ? "edit"
      : resource === "transitions" && req.method === "POST" ? "transition" : undefined;
    const read = req.method === "GET" && resource !== "transitions";
    if (!operation && !read) {
      if (ticketId !== undefined) await getPrisma().$transaction(async tx => {
        await parentAccess(tx, ticketId, user);
        if (actionId !== undefined) await childAccess(tx, ticketId, actionId);
      });
      throw new HttpError(405, "METHOD_NOT_ALLOWED", "This Action operation is not supported.");
    }
    if (operation) {
      pagination(req, []);
      try {
        const result = await mutate(req, ticketId!, actionId, operation);
        if (operation === "create" && !result.replayed) {
          res.location("/api/tickets/" + ticketId + "/actions/" + result.action.id);
          res.status(201);
        }
        res.json(result);
      } catch (error) { mappedError(error); }
      return;
    }
    noBody(req);
    const p = pagination(req, resource === "collection" ? ["page","pageSize","cycle"]
      : resource === "history" ? ["page","pageSize"]
      : resource === "outstanding" ? ["page","pageSize","assigneeId","state"] : []);
    if (resource === "outstanding" && (req.query.assigneeId !== "me" || req.query.state !== "outstanding")) invalidQuery();
    const result = await getPrisma().$transaction(async tx => {
      if (resource === "outstanding") {
        // Count and bounded rows share this predicate and repeatable-read snapshot.
        const predicate = outstandingPredicate(user.id);
        const counts = await tx.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT count(*) AS total FROM "ActionTaken" a JOIN "Ticket" t ON t.id=a."ticketId" WHERE ${predicate}`);
        const rows = await tx.$queryRaw<{ id: number; ticketId: number; cycle: number; status: string; descriptionExcerpt: string; createdAt: Date;
          ticketNumber: string; summary: string; currentStatus: TicketStatus }[]>(Prisma.sql`
          SELECT a.id,a."ticketId",a.cycle,a.status, left(a.description,200) AS "descriptionExcerpt",a."createdAt",
            t."ticketNumber",t.summary,t."currentStatus"
          FROM "ActionTaken" a JOIN "Ticket" t ON t.id=a."ticketId" WHERE ${predicate}
          ORDER BY a."createdAt",a.id LIMIT ${p.pageSize} OFFSET ${p.skip}`);
        return pageResult(rows.map(a => ({ id: a.id, ticketId: a.ticketId, cycle: a.cycle, status: a.status,
          descriptionExcerpt: a.descriptionExcerpt, createdAt: a.createdAt.toISOString(),
          ticket: { id: a.ticketId, ticketNumber: a.ticketNumber, summary: a.summary, currentStatus: a.currentStatus } })), Number(counts[0].total), p);
      }
      await parentAccess(tx, ticketId!, user);
      if (actionId !== undefined) {
        const a = await childAccess(tx, ticketId!, actionId);
        if (resource === "item") return dto(a);
        const where = { actionId };
        const total = await tx.actionTakenRevision.count({ where });
        const rows = await tx.actionTakenRevision.findMany({ where, orderBy: { version: "asc" }, skip: p.skip, take: p.pageSize, include: { actor: { select: userSelect } } });
        return pageResult(rows.map(v => ({ id: v.id, actionId: v.actionId, version: v.version, operation: v.operation,
          actor: v.actor, occurredAt: v.occurredAt.toISOString(), changeReason: v.changeReason, snapshot: v.snapshot })), total, p);
      }
      const where = { ticketId, ...(p.cycle !== undefined ? { cycle: p.cycle } : {}) };
      const total = await tx.actionTaken.count({ where });
      const rows = await tx.actionTaken.findMany({ where, include: actionInclude, orderBy: [{ cycle: "asc" },{ createdAt: "asc" },{ id: "asc" }], skip: p.skip, take: p.pageSize });
      return pageResult(rows.map(dto), total, p);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    res.json(result);
  });
}
actionsRouter.all("/api/tickets/:ticketId/actions", handler("collection"));
actionsRouter.all("/api/tickets/:ticketId/actions/:actionId", handler("item"));
actionsRouter.all("/api/tickets/:ticketId/actions/:actionId/history", handler("history"));
actionsRouter.all("/api/tickets/:ticketId/actions/:actionId/transitions", handler("transitions"));
actionsRouter.all("/api/staff/actions", handler("outstanding"));
