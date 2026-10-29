import { ticketMutationBody } from "./workflow.js";
import type { Request, Response } from "express";
import { getPrisma } from "./prisma.js";
import { HttpError, requireNormal } from "./auth/http.js";
import { positiveId } from "./middleware/requesterInput.js";
import { ticketWrite, assertCanAdvance } from "./ticketConcurrency.js";
import {
  validateTextBody,
  TERMINAL_RESOLUTION_STATUSES,
} from "./workflow.js";

function parsePagination(query: Request["query"]) {
  const pageStr = query.page as string | undefined;
  const pageSizeStr = query.pageSize as string | undefined;

  let page = 1;
  if (pageStr !== undefined) {
    if (!/^[1-9]\d*$/.test(pageStr)) {
      throw new HttpError(400, "VALIDATION_ERROR", "page must be a positive integer.");
    }
    page = Number(pageStr);
  }

  let pageSize = 10;
  if (pageSizeStr !== undefined) {
    if (!/^[1-9]\d*$/.test(pageSizeStr) || ![10, 20, 50].includes(Number(pageSizeStr))) {
      throw new HttpError(400, "VALIDATION_ERROR", "pageSize must be 10, 20, or 50.");
    }
    pageSize = Number(pageSizeStr);
  }

  return { page, pageSize };
}

export async function getPublicComments(req: Request, res: Response) {
  const user = requireNormal(req);
  const ticketId = positiveId(req.params.id, "ticket");
  const { page, pageSize } = parsePagination(req.query);

  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, requesterId: true },
  });

  if (!ticket) {
    throw new HttpError(404, "NOT_FOUND", "Ticket not found");
  }

  if (user.role === "REQUESTER" && ticket.requesterId !== user.id) {
    throw new HttpError(404, "NOT_FOUND", "Ticket not found");
  }

  const [totalItems, comments] = await Promise.all([
    prisma.publicComment.count({ where: { ticketId } }),
    prisma.publicComment.findMany({
      where: { ticketId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        author: {
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const data = comments.map(c => ({
    id: c.id,
    ticketId: c.ticketId,
    body: c.body,
    author: {
      id: c.author.id,
      name: c.author.name,
    },
    createdAt: c.createdAt.toISOString(),
  }));

  res.status(200).json({
    data,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  });
}

export async function createPublicComment(req: Request, res: Response) {
  const user = requireNormal(req);
  if (user.role === "ADMINISTRATOR") {
    throw new HttpError(403, "FORBIDDEN", "Administrators are not permitted to append public comments.");
  }

  const ticketId = positiveId(req.params.id, "ticket");
  const bodyText = validateTextBody(req.body?.body, "Public comment");

  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, requesterId: true },
  });

  if (!ticket) {
    throw new HttpError(404, "NOT_FOUND", "Ticket not found");
  }

  if (user.role === "REQUESTER" && ticket.requesterId !== user.id) {
    throw new HttpError(404, "NOT_FOUND", "Ticket not found");
  }

  const created = await prisma.publicComment.create({
    data: {
      ticketId,
      authorId: user.id,
      body: bodyText,
    },
    include: {
      author: {
        select: { id: true, name: true },
      },
    },
  });

  res.status(201).json({
    id: created.id,
    ticketId: created.ticketId,
    body: created.body,
    author: {
      id: created.author.id,
      name: created.author.name,
    },
    createdAt: created.createdAt.toISOString(),
  });
}

export async function getInternalNotes(req: Request, res: Response) {
  const user = requireNormal(req);
  if (user.role === "REQUESTER") {
    throw new HttpError(403, "FORBIDDEN", "Requesters are not permitted to view internal notes.");
  }

  const ticketId = positiveId(req.params.id, "ticket");
  const { page, pageSize } = parsePagination(req.query);

  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });

  if (!ticket) {
    throw new HttpError(404, "NOT_FOUND", "Ticket not found");
  }

  const [totalItems, notes] = await Promise.all([
    prisma.internalNote.count({ where: { ticketId } }),
    prisma.internalNote.findMany({
      where: { ticketId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        author: {
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const data = notes.map(n => ({
    id: n.id,
    ticketId: n.ticketId,
    body: n.body,
    author: {
      id: n.author.id,
      name: n.author.name,
    },
    createdAt: n.createdAt.toISOString(),
  }));

  res.status(200).json({
    data,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  });
}

export async function createInternalNote(req: Request, res: Response) {
  const user = requireNormal(req);
  if (user.role !== "IT_STAFF") {
    throw new HttpError(403, "FORBIDDEN", "Only IT Staff are permitted to append internal notes.");
  }

  const ticketId = positiveId(req.params.id, "ticket");
  const bodyText = validateTextBody(req.body?.body, "Internal note");

  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });

  if (!ticket) {
    throw new HttpError(404, "NOT_FOUND", "Ticket not found");
  }

  const created = await prisma.internalNote.create({
    data: {
      ticketId,
      authorId: user.id,
      body: bodyText,
    },
    include: {
      author: {
        select: { id: true, name: true },
      },
    },
  });

  res.status(201).json({
    id: created.id,
    ticketId: created.ticketId,
    body: created.body,
    author: {
      id: created.author.id,
      name: created.author.name,
    },
    createdAt: created.createdAt.toISOString(),
  });
}

export async function indicateResolution(req: Request, res: Response) {
  const user = requireNormal(req);
  if (user.role !== "REQUESTER") {
    throw new HttpError(403, "FORBIDDEN", "Only Requesters may indicate that a problem appears resolved.");
  }

  const ticketId = positiveId(req.params.id, "ticket");
  const expectedCycle = ticketMutationBody(req.body, [], "expectedCycle");
  const updated = await ticketWrite(req, ticketId, ["REQUESTER"], async (tx, ticket) => {
    if (ticket.requesterId !== user.id) {
      throw new HttpError(404, "NOT_FOUND", "Ticket not found");
    }

    if (ticket.workCycle !== expectedCycle) throw new HttpError(409, "TICKET_CYCLE_CONFLICT", "Ticket cycle changed. Reload and review.", { currentCycle: ticket.workCycle });

    if (TERMINAL_RESOLUTION_STATUSES.includes(ticket.currentStatus)) {
      throw new HttpError(
        409,
        "TICKET_NOT_ACTIVE",
        "Cannot indicate resolution on a ticket in a resolved, closed, or cancelled status."
      );
    }

    // Idempotent: retain the existing indication and metadata.
    if (ticket.resolutionSuggestedAt) return ticket;

    assertCanAdvance(ticket);
    return tx.ticket.update({
      where: { id: ticketId },
      data: {
        resolutionSuggestedAt: new Date(),
        resolutionSuggestedById: user.id,
        workflowVersion: { increment: 1 },
      },
    });
  });

  res.status(200).json({
    workflowVersion: updated.workflowVersion,
    workCycle: updated.workCycle,
    ticketId: updated.id,
    currentStatus: updated.currentStatus,
    resolutionSuggestedAt: updated.resolutionSuggestedAt!.toISOString(),
    resolutionSuggestedById: user.id,
  });
}
