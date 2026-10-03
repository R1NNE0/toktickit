import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { requireRequester } from "../../src/middleware/requesterAuth.js";
import { createAuth, authErrorHandler } from "../../src/auth/http.js";
import { getPrisma } from "../../src/prisma.js";
import { requesterHeaders } from "../lab-03/legacy-session.js";
const app = express(), auth = createAuth();
app.use(auth.load);
app.get("/test-auth", requireRequester, (req, res) => res.json({ requesterId: req.requesterId }));
app.use(authErrorHandler);
describe("Requester session bridge", () => {
  afterAll(async () => { await getPrisma().$disconnect(); });
  it.each([undefined, "invalid-id", "999999", "1"])("rejects header-only identity %s", async header => {
    const req = request(app).get("/test-auth");
    if (header) req.set("x-requester-id", header);
    await req.expect(401);
  });
  it("takes identity only from the session and ignores a forged header", async () => {
    const user = await getPrisma().user.findFirstOrThrow({ where: { isActive: true, role: "REQUESTER", mustChangePassword: false } });
    const res = await request(app).get("/test-auth").set(await requesterHeaders(user.id)).set("x-requester-id", "999999").expect(200);
    expect(res.body.requesterId).toBe(user.id);
  });
  it("rejects an inactive account even with an otherwise valid database session", async () => {
    const user = await getPrisma().user.findFirstOrThrow({ where: { isActive: false } });
    await request(app).get("/test-auth").set(await requesterHeaders(user.id)).expect(401);
  });
});
