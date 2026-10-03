import { describe, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
describe("Lab 2 development directory retired by session authentication", () => {
  it("does not expose an anonymous persona directory", async () => {
    await request(app).get("/api/requesters/active").expect(404);
  });
});
