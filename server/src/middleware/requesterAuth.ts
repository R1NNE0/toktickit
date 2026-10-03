import { Request, Response, NextFunction } from "express";
import type { User } from "@prisma/client";
import { requireNormal, reject } from "../auth/http.js";
declare global {
  namespace Express {
    interface Request { requester?: User; requesterId?: number; }
  }
}
// Requester-only policy. Later Staff/Admin endpoints must opt into their own capabilities.
export function requireRequester(req: Request, _res: Response, next: NextFunction): void {
  try {
    const user = requireNormal(req);
    if (user.role !== "REQUESTER") reject(403, "FORBIDDEN", "This operation requires a Requester.");
    if (Object.prototype.hasOwnProperty.call(req.query, "requesterId"))
      reject(400, "INVALID_QUERY", "Requester identity comes from the authenticated session.");
    req.requester = user;
    req.requesterId = user.id;
    next();
  } catch (error) { next(error); }
}
