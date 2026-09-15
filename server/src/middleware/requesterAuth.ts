import { Request, Response, NextFunction } from "express";
import type { User } from "@prisma/client";
import { requireNormal, reject } from "../auth/http.js";
declare global {
  namespace Express {
    interface Request { requester?: User; requesterId?: number; }
  }
}
// Minimal Issue 2 bridge. Full role/resource policy belongs to Issue 3.
export function requireRequester(req: Request, _res: Response, next: NextFunction): void {
  try {
    const user = requireNormal(req);
    if (user.role !== "REQUESTER") reject(403, "FORBIDDEN", "This operation requires a Requester.");
    req.requester = user;
    req.requesterId = user.id;
    next();
  } catch (error) { next(error); }
}
