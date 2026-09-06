import { Request, Response, NextFunction } from "express";
import { getPrisma } from "../prisma.js";
import { RequesterUser } from "@prisma/client";

// Extend Express Request interface to include authenticated requester context
declare global {
  namespace Express {
    interface Request {
      requester?: RequesterUser;
      requesterId?: number;
    }
  }
}

/**
 * Middleware to validate and extract `x-requester-id` header in development mode.
 * Ensures the requester exists and is active (`isActive: true`).
 */
export async function requireRequester(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const headerVal = req.headers["x-requester-id"];

  if (!headerVal) {
    res.status(400).json({ error: "Missing required 'x-requester-id' header" });
    return;
  }

  const requesterId = parseInt(
    Array.isArray(headerVal) ? headerVal[0] : headerVal,
    10
  );

  if (isNaN(requesterId) || requesterId <= 0) {
    res.status(400).json({ error: "Invalid 'x-requester-id' header format" });
    return;
  }

  try {
    const requester = await getPrisma().requesterUser.findUnique({
      where: { id: requesterId },
    });

    if (!requester || !requester.isActive) {
      res
        .status(403)
        .json({ error: "Requester not found or is currently inactive" });
      return;
    }

    req.requester = requester;
    req.requesterId = requester.id;
    next();
  } catch (err) {
    console.error("requesterAuth error:", err);
    res.status(500).json({ error: "Failed to authenticate requester context" });
  }
}
