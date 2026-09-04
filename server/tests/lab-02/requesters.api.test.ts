import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Lab 2 (Issue #3) - Active Development Requesters API", () => {
  beforeAll(async () => {
    // Ensure seed data is present
    const prisma = getPrisma();
    const activeCount = await prisma.requesterUser.count({
      where: { isActive: true },
    });
    if (activeCount === 0) {
      throw new Error(
        "Database is not seeded. Please run npm run prisma:seed before testing."
      );
    }
  });

  afterAll(async () => {
    await getPrisma().$disconnect();
  });

  it("API-14: GET /api/requesters/active returns HTTP 200 and array of active requesters only", async () => {
    const res = await request(app).get("/api/requesters/active");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(4);

    // Verify all returned users are active
    for (const requester of res.body) {
      expect(requester).toHaveProperty("id");
      expect(typeof requester.id).toBe("number");
      expect(requester).toHaveProperty("name");
      expect(typeof requester.name).toBe("string");
      expect(requester).toHaveProperty("email");
      expect(typeof requester.email).toBe("string");
      expect(requester.isActive).toBe(true);
    }

    // Verify inactive requester (Robert Taylor) is excluded
    const inactiveUser = res.body.find(
      (r: { email: string }) => r.email === "robert.taylor@example.com"
    );
    expect(inactiveUser).toBeUndefined();
  });

  it("returns active requesters sorted alphabetically by name ascending", async () => {
    const res = await request(app).get("/api/requesters/active");

    expect(res.status).toBe(200);
    const names = res.body.map((r: { name: string }) => r.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNames);
  });
});
