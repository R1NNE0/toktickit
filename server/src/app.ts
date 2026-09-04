import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { getPrisma } from "./prisma.js";
import { requireRequester } from "./middleware/requesterAuth.js";
import { generateTicketNumber } from "./utils/ticketNumber.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors()); // already wired: lets the Vite dev server call this API
app.use(express.json());

// Ensure upload directory exists
const uploadDir = path.resolve(process.cwd(), "uploads/lab-02");
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
app.get("/api/requesters/active", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().requesterUser.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    res.status(200).json(requesters);
  } catch (err) {
    console.error("GET /api/requesters/active error:", err);
    res.status(500).json({ error: "Failed to retrieve active requesters" });
  }
});

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
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = req.requesterId!;
      const {
        search,
        categoryId,
        requestedPriority,
        priority,
        currentStatus,
        status,
        sortBy = "createdAt",
        sortOrder = "desc",
        page = "1",
        pageSize,
        limit,
      } = req.query;

      // 1. Pagination parameters validation
      const parsedPage = parseInt(String(page), 10);
      if (isNaN(parsedPage) || parsedPage < 1) {
        res.status(400).json({ error: "Page must be a positive integer" });
        return;
      }

      const rawLimit = pageSize || limit || "8";
      const parsedLimit = parseInt(String(rawLimit), 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        res
          .status(400)
          .json({ error: "Page size/limit must be a positive integer" });
        return;
      }

      // 2. Status filter validation
      const validStatuses = [
        "NEW",
        "OPEN",
        "IN_PROGRESS",
        "RESOLVED",
        "CLOSED",
      ];
      const rawStatus = currentStatus || status;
      let filterStatus: any = undefined;
      if (rawStatus && typeof rawStatus === "string" && rawStatus.trim()) {
        const normalized = rawStatus.trim().toUpperCase();
        if (!validStatuses.includes(normalized)) {
          res.status(400).json({
            error: `Invalid status parameter. Allowed values: ${validStatuses.join(
              ", "
            )}`,
          });
          return;
        }
        filterStatus = normalized;
      }

      // 3. Priority filter validation
      const validPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
      const rawPriority = requestedPriority || priority;
      let filterPriority: any = undefined;
      if (rawPriority && typeof rawPriority === "string" && rawPriority.trim()) {
        const normalized = rawPriority.trim().toUpperCase();
        if (!validPriorities.includes(normalized)) {
          res.status(400).json({
            error: `Invalid priority parameter. Allowed values: ${validPriorities.join(
              ", "
            )}`,
          });
          return;
        }
        filterPriority = normalized;
      }

      // 4. Category filter validation
      let filterCategoryId: number | undefined;
      if (categoryId) {
        const parsedCat = parseInt(String(categoryId), 10);
        if (isNaN(parsedCat) || parsedCat <= 0) {
          res.status(400).json({ error: "Invalid category ID" });
          return;
        }
        filterCategoryId = parsedCat;
      }

      // 5. Sort parameters
      const allowedSortFields = [
        "createdAt",
        "ticketNumber",
        "requestedPriority",
        "currentStatus",
        "updatedAt",
      ];
      const sortField =
        typeof sortBy === "string" && allowedSortFields.includes(sortBy)
          ? sortBy
          : "createdAt";

      const sortDirection =
        typeof sortOrder === "string" && sortOrder.toLowerCase() === "asc"
          ? "asc"
          : "desc";

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
    } catch (err) {
      console.error("GET /api/tickets error:", err);
      res.status(500).json({ error: "Failed to retrieve tickets" });
    }
  }
);

// ---------------------------------------------------------------------------
// Lab 2 (Issue #4) — Create Ticket
// ---------------------------------------------------------------------------
app.post(
  "/api/tickets",
  requireRequester,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = req.requesterId!;
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
      const priority = requestedPriority
        ? String(requestedPriority).toUpperCase()
        : "MEDIUM";
      if (requestedPriority && !validPriorities.includes(priority)) {
        errors.push({
          field: "requestedPriority",
          message:
            "Requested Priority must be one of LOW, MEDIUM, HIGH, CRITICAL",
        });
      }

      if (errors.length > 0) {
        res.status(400).json({ error: "Validation failed", details: errors });
        return;
      }

      const prisma = getPrisma();

      // 2. Foreign key and active state validation
      const category = await prisma.category.findUnique({
        where: { id: Number(categoryId) },
      });
      if (!category || !category.isActive) {
        res
          .status(400)
          .json({ error: "Selected Category does not exist or is inactive" });
        return;
      }

      const relatedSystem = await prisma.relatedSystem.findUnique({
        where: { id: Number(relatedSystemId) },
      });
      if (!relatedSystem || !relatedSystem.isActive) {
        res.status(400).json({
          error: "Selected Related System does not exist or is inactive",
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
          include: {
            category: { select: { id: true, name: true } },
            relatedSystem: { select: { id: true, name: true } },
            requester: {
              select: { id: true, name: true, email: true },
            },
          },
        });

        if (existing) {
          // Idempotent return of the already created ticket
          res.status(200).json(existing);
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
          itPriority: "MEDIUM",
          currentStatus: "NEW",
          requesterId,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
          idempotencyKey: trimmedKey,
        },
        include: {
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
          requester: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      res.status(201).json(newTicket);
    } catch (err) {
      console.error("POST /api/tickets error:", err);
      res.status(500).json({ error: "Failed to create ticket" });
    }
  }
);

// ---------------------------------------------------------------------------
// Lab 2 (Issue #4) — Upload Attachment to Ticket
// ---------------------------------------------------------------------------
app.post(
  "/api/tickets/:id/attachments",
  requireRequester,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res
            .status(413)
            .json({ error: "File size exceeds maximum allowed limit of 5 MB" });
          return;
        }
        if (err.message === "UNSUPPORTED_FILE_TYPE") {
          res.status(400).json({
            error:
              "Unsupported file type. Allowed formats: JPG, JPEG, PNG, WEBP, PDF",
          });
          return;
        }
        res.status(400).json({ error: err.message || "File upload failed" });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requesterId = req.requesterId!;
      const ticketId = parseInt(req.params.id, 10);

      if (isNaN(ticketId) || ticketId <= 0) {
        res.status(400).json({ error: "Invalid ticket ID" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No file attached in upload request" });
        return;
      }

      const prisma = getPrisma();

      // Check ticket exists
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      // Check ownership
      if (ticket.requesterId !== requesterId) {
        res.status(403).json({
          error: "Forbidden: You cannot attach files to another requester's ticket",
        });
        return;
      }

      // Check active attachments limit (max 5 active attachments)
      const activeCount = await prisma.attachment.count({
        where: {
          ticketId,
          isRemoved: false,
        },
      });

      if (activeCount >= 5) {
        res.status(400).json({
          error:
            "Attachment limit reached: A maximum of 5 active attachments is allowed per ticket",
        });
        return;
      }

      // Record attachment in database
      const attachment = await prisma.attachment.create({
        data: {
          ticketId,
          fileName: req.file.originalname,
          storedPath: req.file.path,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          isRemoved: false,
        },
        select: {
          id: true,
          ticketId: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          isRemoved: true,
          createdAt: true,
        },
      });

      res.status(201).json(attachment);
    } catch (err) {
      console.error("POST /api/tickets/:id/attachments error:", err);
      res.status(500).json({ error: "Failed to upload attachment" });
    }
  }
);

export default app;

