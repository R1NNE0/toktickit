import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { getPrisma } from "./prisma.js";
import { positiveId, bodyFields, requesterQuery } from "./middleware/requesterInput.js";
import { validAttachment, attachmentSelect, ticketDetailInclude } from "./attachments.js";
import { HttpError, asyncRoute } from "./auth/http.js";
import { requireRequester } from "./middleware/requesterAuth.js";
import { createAuth, authErrorHandler, requireNormal } from "./auth/http.js";
import { generateTicketNumber } from "./utils/ticketNumber.js";
import { staffQueue } from "./staffQueue.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

const auth = createAuth();
app.use(cors({ origin: auth.config.origin, credentials: true }));
app.use(express.json({ limit: "128kb" }));
app.use("/api", auth.load);
app.use("/api/auth", auth.router);
// A restricted identity cannot reach any normal API, including public reference data.
app.use("/api", (req, res, next) => {
  try {
    if (req.auth?.user?.mustChangePassword) requireNormal(req);
    next();
  } catch (error) { next(error); }
});
app.use(["/api/tickets", "/api/attachments"], (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) auth.mutation(req, res, next);
  else next();
});

// Max 32-bit signed integer boundary (PostgreSQL serial/int)
const MAX_INT = 2147483647;

app.get("/api/staff/tickets", asyncRoute(staffQueue));

// Ensure upload directory exists
const uploadDir = path.resolve(process.cwd(), process.env.TEST_UPLOAD_ROOT ?? "uploads/lab-02");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage and validation
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("UNSUPPORTED_FILE_TYPE"));
    }
  },
});

// ---------------------------------------------------------------------------
// Lab 1 — API health check
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// Lab 1 & 2 — Category list
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: "asc",
      },
    });
    res.status(200).json(categories);
  } catch (err) {
    console.error("GET /api/categories error:", err);
    res.status(500).json({ error: "Failed to retrieve categories" });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 (Issue #3) — Active Development Requesters
// ---------------------------------------------------------------------------
// The development identity directory cannot establish an authenticated identity.
app.get("/api/requesters/active", (_req, res) => { res.status(404).json({ error: "Not found." }); });

// ---------------------------------------------------------------------------
// Lab 2 — Related Systems list
// ---------------------------------------------------------------------------
app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const systems = await getPrisma().relatedSystem.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    res.status(200).json(systems);
  } catch (err) {
    console.error("GET /api/related-systems error:", err);
    res.status(500).json({ error: "Failed to retrieve related systems" });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 (Issue #5) — List Owned Tickets (My Tickets)
// ---------------------------------------------------------------------------
app.get(
  "/api/tickets",
  requireRequester,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requesterId = req.requesterId!;
      const query = requesterQuery(req.query);
      const { search, categoryId: filterCategoryId, status: filterStatus, priority: filterPriority,
        sortBy: sortField, sortOrder: sortDirection, page: parsedPage, pageSize: parsedLimit } = query;

      // 6. Prisma Where condition (enforces requester isolation)
      const where: any = {
        requesterId,
      };

      if (filterCategoryId) {
        where.categoryId = filterCategoryId;
      }

      if (filterStatus) {
        where.currentStatus = filterStatus;
      }

      if (filterPriority) {
        where.requestedPriority = filterPriority;
      }

      if (search && typeof search === "string" && search.trim()) {
        const term = search.trim();
        where.OR = [
          { ticketNumber: { contains: term, mode: "insensitive" } },
          { summary: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
        ];
      }

      const prisma = getPrisma();

      // 7. Query count and records
      const [totalCount, tickets] = await Promise.all([
        prisma.ticket.count({ where }),
        prisma.ticket.findMany({
          where,
          orderBy: [
            { [sortField]: sortDirection },
            { id: sortDirection },
          ],
          skip: (parsedPage - 1) * parsedLimit,
          take: parsedLimit,
          select: {
            id: true,
            ticketNumber: true,
            summary: true,
            description: true,
            requestedPriority: true,
            itPriority: true,
            currentStatus: true,
            createdAt: true,
            updatedAt: true,
            requesterId: true,
            categoryId: true,
            relatedSystemId: true,
            category: {
              select: { id: true, name: true },
            },
            relatedSystem: {
              select: { id: true, name: true },
            },
            _count: {
              select: {
                attachments: {
                  where: { isRemoved: false },
                },
              },
            },
          },
        }),
      ]);

      const formattedData = tickets.map((t) => {
        const { _count, ...rest } = t;
        return {
          ...rest,
          attachmentCount: _count.attachments,
        };
      });

      const totalPages = Math.ceil(totalCount / parsedLimit) || 1;

      res.status(200).json({
        data: formattedData,
        pagination: {
          total: totalCount,
          totalItems: totalCount,
          page: parsedPage,
          currentPage: parsedPage,
          pageSize: parsedLimit,
          limit: parsedLimit,
          totalPages,
        },
      });
    } catch (err) { next(err); }
  }
);

// ---------------------------------------------------------------------------
// Lab 2 (Issue #4) — Create Ticket
// ---------------------------------------------------------------------------
app.post(
  "/api/tickets",
  requireRequester,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requesterId = req.requesterId!;
      bodyFields(req.body, ["summary", "description", "categoryId", "relatedSystemId", "requestedPriority", "idempotencyKey"]);
      const {
        summary,
        description,
        categoryId,
        relatedSystemId,
        requestedPriority,
        idempotencyKey,
      } = req.body || {};

      // 1. Mandatory fields validation
      const trimmedSummary = typeof summary === "string" ? summary.trim() : "";
      const trimmedDescription =
        typeof description === "string" ? description.trim() : "";

      const errors: Array<{ field: string; message: string }> = [];

      if (!trimmedSummary) {
        errors.push({
          field: "summary",
          message: "Summary is required and cannot be empty",
        });
      }
      if (!trimmedDescription) {
        errors.push({
          field: "description",
          message: "Description is required and cannot be empty",
        });
      }
      if (!categoryId || isNaN(Number(categoryId))) {
        errors.push({
          field: "categoryId",
          message: "Category ID is required and must be a number",
        });
      }
      if (!relatedSystemId || isNaN(Number(relatedSystemId))) {
        errors.push({
          field: "relatedSystemId",
          message: "Related System ID is required and must be a number",
        });
      }

      const validPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
      const priority = requestedPriority === undefined ? "MEDIUM" : requestedPriority;
      if (typeof priority !== "string" || !validPriorities.includes(priority)) {
        errors.push({
          field: "requestedPriority",
          message:
            "Requested Priority must be one of LOW, MEDIUM, HIGH, CRITICAL",
        });
      }

      if (errors.length > 0) {
        res.status(400).json({ error: "Validation failed", code: "VALIDATION_ERROR", details: errors });
        return;
      }

      positiveId(categoryId, "category");
      positiveId(relatedSystemId, "related system");
      if ([...trimmedSummary].length > 200 || [...trimmedDescription].length > 10000
        || (idempotencyKey !== undefined && (typeof idempotencyKey !== "string" || !idempotencyKey.trim() || [...idempotencyKey.trim()].length > 128)))
        throw new HttpError(400, "VALIDATION_ERROR", "Ticket fields exceed the allowed limits.");
      const prisma = getPrisma();

      // 2. Foreign key and active state validation
      const category = await prisma.category.findUnique({
        where: { id: Number(categoryId) },
      });
      if (!category || !category.isActive) {
        res
          .status(400)
          .json({ error: "Selected Category does not exist or is inactive", code: "VALIDATION_ERROR" });
        return;
      }

      const relatedSystem = await prisma.relatedSystem.findUnique({
        where: { id: Number(relatedSystemId) },
      });
      if (!relatedSystem || !relatedSystem.isActive) {
        res.status(400).json({
          error: "Selected Related System does not exist or is inactive", code: "VALIDATION_ERROR",
        });
        return;
      }

      // 3. Idempotency handling
      const trimmedKey =
        typeof idempotencyKey === "string" && idempotencyKey.trim()
          ? idempotencyKey.trim()
          : null;

      if (trimmedKey) {
        const existing = await prisma.ticket.findFirst({
          where: {
            requesterId,
            idempotencyKey: trimmedKey,
          },
          include: ticketDetailInclude,
        });

        if (existing) {
          // Idempotent return of the already created ticket
          res.status(200).json({ ...existing, attachmentCount: existing.attachments.filter(a => !a.isRemoved).length });
          return;
        }
      }

      // 4. Generate unique sequential ticket number
      const ticketNumber = await generateTicketNumber(prisma);

      // 5. Create ticket
      const newTicket = await prisma.ticket.create({
        data: {
          ticketNumber,
          summary: trimmedSummary,
          description: trimmedDescription,
          requestedPriority: priority as any,
          itPriority: priority as any,
          currentStatus: "NEW",
          requesterId,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
          idempotencyKey: trimmedKey,
        },
        include: ticketDetailInclude,
      });

      res.status(201).json({ ...newTicket, attachmentCount: 0 });
    } catch (err) {
      // The existing requester/key constraint is the atomic arbiter of simultaneous retries.
      if ((err as { code?: string }).code === "P2002" && typeof req.body?.idempotencyKey === "string") {
        try {
          const existing = await getPrisma().ticket.findFirst({ where: { requesterId: req.requesterId!, idempotencyKey: req.body.idempotencyKey.trim() }, include: ticketDetailInclude });
          if (existing) { res.status(200).json({ ...existing, attachmentCount: existing.attachments.filter(a => !a.isRemoved).length }); return; }
        } catch (lookupError) { next(lookupError); return; }
      }
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Lab 2 (Issue #4) — Upload Attachment to Ticket
// ---------------------------------------------------------------------------
app.post(
  "/api/tickets/:id/attachments",
  requireRequester,
  asyncRoute(async (req, _res, next) => {
    const id = positiveId(req.params.id, "ticket");
    const ticket = await getPrisma().ticket.findFirst({ where: { id, requesterId: req.requesterId! }, select: { id: true } });
    if (!ticket) throw new HttpError(404, "NOT_FOUND", "Ticket not found");
    next();
  }),
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err: any) => {
      if (!err) { next(); return; }
      if (err.code === "LIMIT_FILE_SIZE") next(new HttpError(413, "PAYLOAD_TOO_LARGE", "File size exceeds maximum allowed limit of 5 MB"));
      else next(new HttpError(400, err.message === "UNSUPPORTED_FILE_TYPE" ? "UNSUPPORTED_FILE_TYPE" : "VALIDATION_ERROR", "Unsupported file type or invalid upload. Allowed formats: JPG, JPEG, PNG, WEBP, PDF"));
    });
  },
  asyncRoute(async (req, res) => {
    let recorded = false;
    try {
      bodyFields(req.body, []);
      if (!req.file) throw new HttpError(400, "VALIDATION_ERROR", "No file attached in upload request");
      if (!await validAttachment(req.file)) throw new HttpError(400, "UNSUPPORTED_FILE_TYPE", "Unsupported file type or signature.");
      const file = req.file, ticketId = positiveId(req.params.id, "ticket");
      const attachment = await getPrisma().$transaction(async tx => {
        // Serialize count + insert for this ticket, including concurrent fifth/sixth uploads.
        const rows = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "Ticket" WHERE id = ${ticketId} AND "requesterId" = ${req.requesterId!} FOR UPDATE`;
        if (!rows.length) throw new HttpError(404, "NOT_FOUND", "Ticket not found");
        if (await tx.attachment.count({ where: { ticketId, isRemoved: false } }) >= 5)
          throw new HttpError(400, "ATTACHMENT_LIMIT", "Attachment limit reached: A maximum of 5 active attachments is allowed per ticket");
        return tx.attachment.create({ data: { ticketId, fileName: file.originalname, storedPath: file.path,
          fileSize: file.size, mimeType: file.mimetype }, select: attachmentSelect });
      });
      recorded = true;
      res.status(201).json(attachment);
    } finally {
      if (req.file && !recorded) await fs.promises.unlink(req.file.path);
    }
  })
);

// ---------------------------------------------------------------------------
// GET /api/tickets/:id (FR-07 / AC-04 / AC-06)
// ---------------------------------------------------------------------------
app.get(
  "/api/tickets/:id",
  requireRequester,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requesterId = req.requesterId!;
      const ticketId = positiveId(req.params.id, "ticket");

      if (isNaN(ticketId) || ticketId <= 0 || ticketId > MAX_INT) {
        res.status(400).json({ error: "Invalid ticket ID" });
        return;
      }

      const prisma = getPrisma();
      const ticket = await prisma.ticket.findFirst({
        where: { id: ticketId, requesterId },
        include: {
          category: {
            select: { id: true, name: true },
          },
          relatedSystem: {
            select: { id: true, name: true },
          },
          requester: {
            select: { id: true, name: true, email: true },
          },
          attachments: {
            select: {
              id: true,
              ticketId: true,
              fileName: true,
              fileSize: true,
              mimeType: true,
              isRemoved: true,
              removedAt: true,
              removalReason: true,
              createdAt: true,
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      });

      if (!ticket) {
        res.status(404).json({ error: "Ticket not found", code: "NOT_FOUND" });
        return;
      }

      res.json({ ...ticket, attachmentCount: ticket.attachments.filter(a => !a.isRemoved).length });
    } catch (err) { next(err); }
  }
);

// ---------------------------------------------------------------------------
// GET /api/attachments/:id/download (FR-09 / AC-08 / BR-08)
// ---------------------------------------------------------------------------
app.get(
  "/api/attachments/:id/download",
  requireRequester,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requesterId = req.requesterId!;
      const attachmentId = positiveId(req.params.id, "attachment");

      if (isNaN(attachmentId) || attachmentId <= 0 || attachmentId > MAX_INT) {
        res.status(400).json({ error: "Invalid attachment ID" });
        return;
      }

      const prisma = getPrisma();
      const attachment = await prisma.attachment.findFirst({
        where: { id: attachmentId, ticket: { requesterId } },
        include: {
          ticket: {
            select: {
              id: true,
              requesterId: true,
            },
          },
        },
      });

      if (!attachment) {
        res.status(404).json({ error: "Attachment not found", code: "NOT_FOUND" });
        return;
      }

      // Check if attachment has been soft-removed (BR-08 / AC-08)
      if (attachment.isRemoved) {
        res.status(403).json({
          code: "ATTACHMENT_REMOVED",
          error:
            "Attachment has been removed and is no longer available for download",
        });
        return;
      }

      // Resolve physical storedPath
      const resolvedPath = path.isAbsolute(attachment.storedPath)
        ? attachment.storedPath
        : path.resolve(process.cwd(), attachment.storedPath);

      if (!fs.existsSync(resolvedPath)) {
        res.status(404).json({ error: "Attachment file not found on server", code: "FILE_UNAVAILABLE" });
        return;
      }

      res.setHeader("Content-Type", attachment.mimeType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      const asciiFallback =
        attachment.fileName.replace(/[^\x20-\x7e]/g, "_") || "attachment";
      const encodedName = encodeURIComponent(attachment.fileName);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`
      );
      res.download(resolvedPath, attachment.fileName);
    } catch (err) { next(err); }
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/attachments/:id (FR-10 / AC-08 / BR-08)
// ---------------------------------------------------------------------------
app.delete(
  "/api/attachments/:id",
  requireRequester,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requesterId = req.requesterId!;
      const attachmentId = positiveId(req.params.id, "attachment");

      if (isNaN(attachmentId) || attachmentId <= 0 || attachmentId > MAX_INT) {
        res.status(400).json({ error: "Invalid attachment ID" });
        return;
      }

      const prisma = getPrisma();
      const attachment = await prisma.attachment.findFirst({
        where: { id: attachmentId, ticket: { requesterId } },
        include: {
          ticket: {
            select: {
              id: true,
              requesterId: true,
            },
          },
        },
      });

      if (!attachment) {
        res.status(404).json({ error: "Attachment not found", code: "NOT_FOUND" });
        return;
      }

      bodyFields(req.body, ["reason"]);
      const { reason } = req.body || {};
      if (typeof reason !== "string" || !reason.trim() || [...reason.trim()].length > 1000)
        throw new HttpError(400, "VALIDATION_ERROR", "Removal reason is required and must be 1–1000 characters.");

      // Concurrency & Audit Guard: Prevent double-removal from overwriting existing audit record
      if (attachment.isRemoved) {
        res.status(409).json({
          error: "Conflict: This attachment has already been removed", code: "ALREADY_REMOVED",
        });
        return;
      }

      // Soft removal: do NOT delete from filesystem
      const removed = await prisma.attachment.updateMany({
        where: { id: attachmentId, isRemoved: false },
        data: { isRemoved: true, removedAt: new Date(), removalReason: reason.trim() },
      });
      if (removed.count !== 1) throw new HttpError(409, "ALREADY_REMOVED", "Conflict: This attachment has already been removed");
      const updated = await prisma.attachment.findUniqueOrThrow({
        where: { id: attachmentId },
        select: {
          id: true,
          fileName: true,
          isRemoved: true,
          removedAt: true,
          removalReason: true,
        },
      });

      res.status(200).json(updated);
    } catch (err) { next(err); }
  }
);

app.use(authErrorHandler);

export default app;

