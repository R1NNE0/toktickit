import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { requireRequester } from "../../src/middleware/requesterAuth.js";

describe("UNIT-03 current Requester capability gate (Staff/Admin operations deferred)", () => {
  it.each(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"])("checks exact role %s without inheritance", role => {
    const req = { auth: { user: { id: 7, role, mustChangePassword: false } }, query: {} } as unknown as Request;
    const next = vi.fn(); requireRequester(req, {} as Response, next);
    if (role === "REQUESTER") { expect(next).toHaveBeenCalledWith(); expect(req.requesterId).toBe(7); }
    else { expect(next.mock.calls[0][0]).toMatchObject({ status: 403, code: "FORBIDDEN" }); expect(req.requesterId).toBeUndefined(); }
  });
});
