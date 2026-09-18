import type { Request, Response } from "express";
import { Priority, TicketStatus } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { HttpError, requireNormal } from "./auth/http.js";
import { positiveId } from "./middleware/requesterInput.js";
import { ticketDetailInclude } from "./attachments.js";
import {
  VALID_PRIORITIES,
  VALID_STATUSES,
  getTransitionRule,
  validateTextBody,
} from "./workflow.js";

export function formatTicketDetail(ticket: any) {
  const activeCount = ticket.attachments
    ? ticket.attachments.filter((a: any) => !a.isRemoved).length
    : 0;
  return {
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
    ownerId: ticket.ownerId ?? null,
    owner: ticket.owner ? { id: ticket.owner.id, name: ticket.owner.name } : null,
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
  if (user.role !== "IT_STAFF") {
    throw new HttpError(403, "FORBIDDEN", "This operation requires IT Staff.");
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
  if (user.role !== "IT_STAFF") {
    throw new HttpError(403, "FORBIDDEN", "This operation requires IT Staff.");
  }
  const ticketId = positiveId(req.params.id, "ticket");
  const ticket = await getPrisma().ticket.findUnique({
    where: { id: ticketId },
    include: ticketDetailInclude,
  });
  if (!ticket) {
    throw new HttpError(404, "NOT_FOUND", "Ticket not found");
  }
  res.status(200).json(formatTicketDetail(ticket));
}

export async function claimTicket(req: Request, res: Response) {
  const user = requireNormal(req);
  if (user.role !== "IT_STAFF") {
    throw new HttpError(403, "FORBIDDEN", "This operation requires IT Staff.");
  }
  const ticketId = positiveId(req.params.id, "ticket");
  const prisma = getPrisma();

  const updated = await prisma.$transaction(async tx => {
    const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new HttpError(404, "NOT_FOUND", "Ticket not found");
    }
    if (ticket.ownerId !== null) {
      throw new HttpError(409, "ALREADY_ASSIGNED", "Ticket is already assigned.");
    }
    return tx.ticket.update({
      where: { id: ticketId },
      data: { ownerId: user.id },
      include: ticketDetailInclude,
    });
  });

  res.status(200).json(formatTicketDetail(updated));
}

export async function updateTicketOwner(req: Request, res: Response) {
  const user = requireNormal(req);
  if (user.role !== "IT_STAFF") {
    throw new HttpError(403, "FORBIDDEN", "This operation requires IT Staff.");
  }
  const ticketId = positiveId(req.params.id, "ticket");
  const { ownerId } = req.body ?? {};

  if (
    ownerId !== null &&
    (typeof ownerId !== "number" || !Number.isInteger(ownerId) || ownerId < 1 || ownerId > 2147483647)
  ) {
    throw new HttpError(400, "VALIDATION_ERROR", "ownerId must be a positive integer or null.");
  }

  const prisma = getPrisma();
  const updated = await prisma.$transaction(async tx => {
    const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new HttpError(404, "NOT_FOUND", "Ticket not found");
    }

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
      return tx.ticket.findUniqueOrThrow({
        where: { id: ticketId },
        include: ticketDetailInclude,
      });
    }

    return tx.ticket.update({
      where: { id: ticketId },
      data: { ownerId },
      include: ticketDetailInclude,
    });
  });

  res.status(200).json(formatTicketDetail(updated));
}

export async function updateTicketPriority(req: Request, res: Response) {
  const user = requireNormal(req);
  if (user.role !== "IT_STAFF" && user.role !== "ADMINISTRATOR") {
    throw new HttpError(403, "FORBIDDEN", "This operation requires IT Staff or Administrator.");
  }
  const ticketId = positiveId(req.params.id, "ticket");
  const { itPriority } = req.body ?? {};

  if (typeof itPriority !== "string" || !VALID_PRIORITIES.includes(itPriority as Priority)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Valid itPriority is required (LOW, MEDIUM, HIGH, CRITICAL).");
  }

  const prisma = getPrisma();
  const updated = await prisma.$transaction(async tx => {
    const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new HttpError(404, "NOT_FOUND", "Ticket not found");
    }
    if (ticket.itPriority === itPriority) {
      return tx.ticket.findUniqueOrThrow({
        where: { id: ticketId },
        include: ticketDetailInclude,
      });
    }
    return tx.ticket.update({
      where: { id: ticketId },
      data: { itPriority: itPriority as Priority },
      include: ticketDetailInclude,
    });
  });

  res.status(200).json(formatTicketDetail(updated));
}

export async function updateTicketStatus(req: Request, res: Response) {
  const user = requireNormal(req);
  if (user.role !== "IT_STAFF") {
    throw new HttpError(403, "FORBIDDEN", "This operation requires IT Staff.");
  }
  const ticketId = positiveId(req.params.id, "ticket");
  const { currentStatus, confirmed, reason } = req.body ?? {};

  if (typeof currentStatus !== "string" || !VALID_STATUSES.includes(currentStatus as TicketStatus)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid target status enum value.");
  }

  const prisma = getPrisma();
  const updated = await prisma.$transaction(async tx => {
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      include: { owner: true },
    });
    if (!ticket) {
      throw new HttpError(404, "NOT_FOUND", "Ticket not found");
    }

    const rule = getTransitionRule(ticket.currentStatus, currentStatus as TicketStatus);
    if (!rule) {
      throw new HttpError(
        409,
        "CONFLICT",
        `Transition from ${ticket.currentStatus} to ${currentStatus} is not permitted.`
      );
    }

    if (rule.requiresOwner) {
      if (
        !ticket.ownerId ||
        !ticket.owner?.isActive ||
        !["IT_STAFF", "ADMINISTRATOR"].includes(ticket.owner.role)
      ) {
        throw new HttpError(
          409,
          "CONFLICT",
          "This status transition requires an active eligible assigned owner."
        );
      }
    }

    if (rule.requiresConfirmation && confirmed !== true) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "This status transition requires explicit confirmation."
      );
    }

    let reasonText: string | null = null;
    if (rule.requiresReason) {
      reasonText = validateTextBody(reason, "Public reason");
    }

    if (reasonText) {
      await tx.publicComment.create({
        data: {
          ticketId,
          authorId: user.id,
          body: reasonText,
        },
      });
    }

    const updateData: any = {
      currentStatus: currentStatus as TicketStatus,
    };

    if (rule.clearsResolution) {
      updateData.resolutionSuggestedAt = null;
      updateData.resolutionSuggestedById = null;
    }

    return tx.ticket.update({
      where: { id: ticketId },
      data: updateData,
      include: ticketDetailInclude,
    });
  });

  res.status(200).json(formatTicketDetail(updated));
}
