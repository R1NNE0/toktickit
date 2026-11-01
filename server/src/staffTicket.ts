import type { Request, Response } from "express";
import { Priority, TicketStatus, type Prisma, type UserRole } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { HttpError, requireNormal } from "./auth/http.js";
import { positiveId } from "./middleware/requesterInput.js";
import { ticketDetailInclude } from "./attachments.js";
import { ticketWrite, assertCanAdvance, assertTicketVersion } from "./ticketConcurrency.js";
import {
  VALID_PRIORITIES,
  VALID_STATUSES,
  getTransitionRule,
  validateTextBody, ticketMutationBody, transitionOptions, transitionBlockers,
} from "./workflow.js";

import { resolutionState } from "./ticketWorkflow.js";

export async function formatTicketDetail(tx: Prisma.TransactionClient, ticket: any, role: UserRole) {
  const resolutionBlockers = await resolutionState(tx, ticket);
  const activeCount = ticket.attachments
    ? ticket.attachments.filter((a: any) => !a.isRemoved).length
    : 0;
  return {
    resolutionBlockers,
    permittedTransitions: transitionOptions(ticket.currentStatus, role, resolutionBlockers),
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    summary: ticket.summary,
    description: ticket.description,
    requesterId: ticket.requesterId,
    categoryId: ticket.categoryId,
    relatedSystemId: ticket.relatedSystemId,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    currentStatus: ticket.currentStatus,
    workflowVersion: ticket.workflowVersion,
    workCycle: ticket.workCycle,
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    ownerId: ticket.ownerId ?? null,
    owner: ticket.owner ? {
      id: ticket.owner.id, name: ticket.owner.name, role: ticket.owner.role, isActive: ticket.owner.isActive,
    } : null,
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    requester: ticket.requester
      ? { id: ticket.requester.id, name: ticket.requester.name, email: ticket.requester.email }
      : undefined,
    attachments: ticket.attachments ?? [],
    attachmentCount: activeCount,
    resolutionSuggestedAt: ticket.resolutionSuggestedAt
      ? typeof ticket.resolutionSuggestedAt.toISOString === "function"
        ? ticket.resolutionSuggestedAt.toISOString()
        : ticket.resolutionSuggestedAt
      : null,
    resolutionSuggestedById: ticket.resolutionSuggestedById ?? null,
    createdAt: typeof ticket.createdAt.toISOString === "function"
      ? ticket.createdAt.toISOString()
      : ticket.createdAt,
    updatedAt: typeof ticket.updatedAt.toISOString === "function"
      ? ticket.updatedAt.toISOString()
      : ticket.updatedAt,
  };
}

export async function getStaffAssignees(req: Request, res: Response) {
  const user = requireNormal(req);
  if (user.role !== "IT_STAFF" && user.role !== "ADMINISTRATOR") {
    throw new HttpError(403, "FORBIDDEN", "This read requires IT Staff or Administrator.");
  }
  const assignees = await getPrisma().user.findMany({
    where: {
      isActive: true,
      role: { in: ["IT_STAFF", "ADMINISTRATOR"] },
    },
    select: { id: true, name: true, role: true, isActive: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  res.status(200).json(assignees);
}

export async function getStaffTicketDetail(req: Request, res: Response) {
  const user = requireNormal(req);
  if (user.role !== "IT_STAFF" && user.role !== "ADMINISTRATOR") {
    throw new HttpError(403, "FORBIDDEN", "This read requires IT Staff or Administrator.");
  }
  const ticketId = positiveId(req.params.id, "ticket");
  res.status(200).json(await readTicketDetail(ticketId, user));
}

export async function readTicketDetail(ticketId: number, user: { id: number; role: UserRole }) {
  return getPrisma().$transaction(async tx => {
    const ticket = await tx.ticket.findUnique({ where: { id: ticketId }, include: ticketDetailInclude });
    if (!ticket || (user.role === "REQUESTER" && ticket.requesterId !== user.id))
      throw new HttpError(404, "NOT_FOUND", "Ticket not found");
    return formatTicketDetail(tx, ticket, user.role);
  }, { isolationLevel: "RepeatableRead" });
}

export async function claimTicket(req: Request, res: Response) {
  const user = requireNormal(req);
  if (user.role !== "IT_STAFF") {
    throw new HttpError(403, "FORBIDDEN", "This operation requires IT Staff.");
  }
  const ticketId = positiveId(req.params.id, "ticket");
  const expectedWorkflowVersion = ticketMutationBody(req.body, []);

  const updated = await ticketWrite(req, ticketId, ["IT_STAFF"], async (tx, locked) => {
    assertTicketVersion(locked, expectedWorkflowVersion);
    const ticket = locked;
    if (ticket.ownerId !== null) {
      throw new HttpError(409, "ALREADY_ASSIGNED", "Ticket is already assigned.");
    }
    assertCanAdvance(locked);
    return formatTicketDetail(tx, await tx.ticket.update({
      where: { id: ticketId },
      data: { ownerId: user.id, workflowVersion: { increment: 1 } },
      include: ticketDetailInclude,
    }), user.role);
  });

  res.status(200).json(updated);
}

export async function updateTicketOwner(req: Request, res: Response) {
  const user = requireNormal(req);
  if (user.role !== "IT_STAFF") {
    throw new HttpError(403, "FORBIDDEN", "This operation requires IT Staff.");
  }
  const ticketId = positiveId(req.params.id, "ticket");
  const expectedWorkflowVersion = ticketMutationBody(req.body, ["ownerId"]);
  const { ownerId } = req.body;

  if (
    ownerId !== null &&
    (typeof ownerId !== "number" || !Number.isInteger(ownerId) || ownerId < 1 || ownerId > 2147483647)
  ) {
    throw new HttpError(400, "VALIDATION_ERROR", "ownerId must be a positive integer or null.");
  }

  const updated = await ticketWrite(req, ticketId, ["IT_STAFF"], async (tx, locked) => {
    assertTicketVersion(locked, expectedWorkflowVersion);
    const ticket = locked;

    if (ownerId !== null) {
      const candidate = await tx.user.findUnique({ where: { id: ownerId } });
      if (
        !candidate ||
        !candidate.isActive ||
        !["IT_STAFF", "ADMINISTRATOR"].includes(candidate.role)
      ) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "Selected owner is not an active eligible IT Staff or Administrator."
        );
      }
    }

    if (ticket.ownerId === ownerId) {
      return formatTicketDetail(tx, await tx.ticket.findUniqueOrThrow({
        where: { id: ticketId },
        include: ticketDetailInclude,
      }), user.role);
    }

    assertCanAdvance(locked);
    return formatTicketDetail(tx, await tx.ticket.update({
      where: { id: ticketId },
      data: { ownerId, workflowVersion: { increment: 1 } },
      include: ticketDetailInclude,
    }), user.role);
  });

  res.status(200).json(updated);
}

export async function updateTicketPriority(req: Request, res: Response) {
  const user = requireNormal(req);
  if (user.role !== "IT_STAFF" && user.role !== "ADMINISTRATOR") {
    throw new HttpError(403, "FORBIDDEN", "This operation requires IT Staff or Administrator.");
  }
  const ticketId = positiveId(req.params.id, "ticket");
  const expectedWorkflowVersion = ticketMutationBody(req.body, ["itPriority"]);
  const { itPriority } = req.body;

  if (typeof itPriority !== "string" || !VALID_PRIORITIES.includes(itPriority as Priority)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Valid itPriority is required (LOW, MEDIUM, HIGH, CRITICAL).");
  }

  const updated = await ticketWrite(req, ticketId, ["IT_STAFF", "ADMINISTRATOR"], async (tx, locked) => {
    assertTicketVersion(locked, expectedWorkflowVersion);
    const ticket = locked;
    if (ticket.itPriority === itPriority) {
      return formatTicketDetail(tx, await tx.ticket.findUniqueOrThrow({
        where: { id: ticketId },
        include: ticketDetailInclude,
      }), user.role);
    }
    assertCanAdvance(locked);
    return formatTicketDetail(tx, await tx.ticket.update({
      where: { id: ticketId },
      data: { itPriority: itPriority as Priority, workflowVersion: { increment: 1 } },
      include: ticketDetailInclude,
    }), user.role);
  });

  res.status(200).json(updated);
}

export async function updateTicketStatus(req: Request, res: Response) {
  const user = requireNormal(req);
  if (user.role !== "IT_STAFF") {
    throw new HttpError(403, "FORBIDDEN", "This operation requires IT Staff.");
  }
  const ticketId = positiveId(req.params.id, "ticket");
  const expectedWorkflowVersion = ticketMutationBody(req.body, ["currentStatus", "confirmed", "reason"]);
  const { currentStatus, confirmed, reason } = req.body;
  if (confirmed !== undefined && typeof confirmed !== "boolean")
    throw new HttpError(400, "VALIDATION_ERROR", "confirmed must be a boolean.");
  if (reason !== undefined) validateTextBody(reason, "Public reason");

  if (typeof currentStatus !== "string" || !VALID_STATUSES.includes(currentStatus as TicketStatus)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid target status enum value.");
  }

  const updated = await ticketWrite(req, ticketId, ["IT_STAFF"], async (tx, locked) => {
    assertTicketVersion(locked, expectedWorkflowVersion);
    const ticket = locked;

    const rule = getTransitionRule(ticket.currentStatus, currentStatus as TicketStatus);
    if (!rule) {
      throw new HttpError(
        409,
        "INVALID_TRANSITION",
        `Transition from ${ticket.currentStatus} to ${currentStatus} is not permitted.`
      );
    }

    if (rule.requiresConfirmation && confirmed !== true) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "This status transition requires explicit confirmation."
      );
    }

    if (!rule.requiresReason && reason !== undefined)
      throw new HttpError(400, "VALIDATION_ERROR", "A public reason is only accepted for cancellation or reopening.");
    const reasonText = rule.requiresReason ? validateTextBody(reason, "Public reason") : null;
    const state = await resolutionState(tx, locked);
    const blockers = transitionBlockers(rule, state);
    if (blockers.length) {
      const context = { currentWorkflowVersion: locked.workflowVersion };
      if (currentStatus === "RESOLVED") throw new HttpError(409, "RESOLUTION_BLOCKED",
        "Complete the remaining work before resolving this ticket.", { ...context, details: state });
      if (currentStatus === "CANCELLED") throw new HttpError(409, "ACTIONS_INCOMPLETE",
        "Cancel or complete unfinished Actions first.", { ...context, details: { incompleteActions: state.incompleteActions } });
      throw new HttpError(409, "OWNER_REQUIRED", "This transition requires an active eligible owner.", context);
    }
    assertCanAdvance(locked);
    if (rule.clearsResolution && ticket.workCycle >= 2147483647)
      throw new HttpError(500, "INTERNAL_ERROR", "Unable to complete the request.");

    if (reasonText) {
      await tx.publicComment.create({
        data: {
          ticketId,
          authorId: user.id,
          body: reasonText,
        },
      });
    }

    const updateData: Prisma.TicketUncheckedUpdateInput = {
      currentStatus: currentStatus as TicketStatus,
      workflowVersion: { increment: 1 },
    };

    if (currentStatus === "RESOLVED") updateData.resolvedAt = new Date();
    if (rule.clearsResolution) {
      updateData.workCycle = { increment: 1 };
      updateData.resolvedAt = null;
      updateData.resolutionSuggestedAt = null;
      updateData.resolutionSuggestedById = null;
    }

    return formatTicketDetail(tx, await tx.ticket.update({
      where: { id: ticketId },
      data: updateData,
      include: ticketDetailInclude,
    }), user.role);
  });

  res.status(200).json(updated);
}
