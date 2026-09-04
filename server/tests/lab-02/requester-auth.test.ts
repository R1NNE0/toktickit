import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { requireRequester } from "../../src/middleware/requesterAuth.js";
import { getPrisma } from "../../src/prisma.js";

describe("Lab 2 (Issue #3) - requireRequester Middleware", () => {
  let testApp: express.Express;
  let activeRequesterId: number;
  let inactiveRequesterId: number;

  beforeAll(async () => {
    const prisma = getPrisma();
    const activeUser = await prisma.requesterUser.findFirst({
      where: { isActive: true },
    });
    const inactiveUser = await prisma.requesterUser.findFirst({
      where: { isActive: false },
    });

    if (!activeUser || !inactiveUser) {
      throw new Error("Seed data must include active and inactive users.");
    }

    activeRequesterId = activeUser.id;
    inactiveRequesterId = inactiveUser.id;

    testApp = express();
    testApp.use(express.json());
    testApp.get("/test-auth", requireRequester, (req, res) => {
      res.status(200).json({
        success: true,
        requesterId: req.requesterId,
        name: req.requester?.name,
      });
    });
  });

  afterAll(async () => {
    await getPrisma().$disconnect();
  });

  it("returns 400 Bad Request if x-requester-id header is missing", async () => {
    const res = await request(testApp).get("/test-auth");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing required 'x-requester-id'/i);
  });

  it("returns 400 Bad Request if x-requester-id is not a valid number", async () => {
    const res = await request(testApp)
      .get("/test-auth")
      .set("x-requester-id", "invalid-id");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid 'x-requester-id'/i);
  });

  it("returns 403 Forbidden if requester is inactive", async () => {
    const res = await request(testApp)
      .get("/test-auth")
      .set("x-requester-id", String(inactiveRequesterId));
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/inactive/i);
  });

  it("returns 403 Forbidden if requester ID does not exist in DB", async () => {
    const res = await request(testApp)
      .get("/test-auth")
      .set("x-requester-id", "999999");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("passes authentication and attaches requester context when x-requester-id is valid", async () => {
    const res = await request(testApp)
      .get("/test-auth")
      .set("x-requester-id", String(activeRequesterId));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.requesterId).toBe(activeRequesterId);
  });
});
