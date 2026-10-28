import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { db, fixture, actionsPath, createBody } from "./api-fixtures.js";
import { requesterHeaders } from "../lab-03/legacy-session.js";
import { hashPassword } from "../../src/auth/password.js";

describe("L4-API-06/07 Action authorization", () => {
  it("returns approved validation field associations without reflecting unknown input", async () => {
    const f = await fixture(), url = actionsPath(f.ticket.id);
    for (const [field, value] of [["description", " "], ["followUpRequired", "true"], ["assigneeId", "1"], ["clientRequestId", "bad"]]) {
      const failure = await request(app).post(url).set(f.staffHeaders).send(createBody({ [field as string]: value })).expect(400);
      expect(failure.body.code).toBe("VALIDATION_ERROR");
      expect(failure.body.details.fields[field as string]).toEqual(expect.any(String));
    }
    const forged = await request(app).post(url).set(f.staffHeaders).send(createBody({ maliciousField: "private-text" })).expect(400);
    expect(JSON.stringify(forged.body)).not.toMatch(/maliciousField|private-text/);
  });
  it("isolates Requesters and hides mismatched or absent children identically", async () => {
    const f = await fixture(), url = actionsPath(f.ticket.id);
    const a = (await request(app).post(url).set(f.staffHeaders).send(createBody()).expect(201)).body.action;
    await request(app).get(url).set(f.requesterHeaders).expect(200);
    await request(app).get(url + "/" + a.id).set(f.requesterHeaders).expect(200);
    const other = await f.makeTicket(f.other.id);
    const denied = await request(app).get(url + "/" + a.id).set(f.otherHeaders).expect(404);
    for (const path of [actionsPath(2147483647), url + "/2147483647", actionsPath(other.id) + "/" + a.id]) {
      const missing = await request(app).get(path).set(f.otherHeaders).expect(404);
      expect(missing.body).toEqual(denied.body);
    }
    for (const path of [url + "/" + a.id + "/history", actionsPath(2147483647) + "/1/history"]) {
      expect((await request(app).get(path).set(f.requesterHeaders).expect(403)).body.code).toBe("FORBIDDEN");
    }
  });
  it("denies Requester writes and preserves Administrator restrictions outside Actions", async () => {
    const f = await fixture(), url = actionsPath(f.ticket.id);
    const a = (await request(app).post(url).set(f.adminHeaders).send(createBody()).expect(201)).body.action;
    for (const [method, path] of [["post",url], ["patch",url + "/" + a.id], ["post",url + "/" + a.id + "/transitions"]] as const) {
      await request(app)[method](path).set(f.requesterHeaders).send({}).expect(403);
    }
    await request(app).get("/api/staff/actions?assigneeId=me&state=outstanding").set(f.requesterHeaders).expect(403);
    for (const [method, path, body] of [
      ["post", "/api/staff/tickets/" + f.ticket.id + "/claim", {}],
      ["patch", "/api/staff/tickets/" + f.ticket.id + "/owner", { ownerId: f.admin.id }],
      ["patch", "/api/staff/tickets/" + f.ticket.id + "/status", { currentStatus: "OPEN" }],
      ["post", "/api/tickets/" + f.ticket.id + "/comments", { body: "private?" }],
      ["post", "/api/tickets/" + f.ticket.id + "/notes", { body: "note" }],
    ] as const) await request(app)[method](path).set(f.adminHeaders).send(body).expect(403);
  });
  it("uses real cookie login, Origin/CSRF enforcement and no-store on errors", async () => {
    const f = await fixture(), url = actionsPath(f.ticket.id), password = "Synthetic API login fixture!";
    await db.user.update({ where: { id: f.staff.id }, data: { passwordHash: await hashPassword(password) } });
    const agent = request.agent(app);
    const bootstrap = await agent.get("/api/auth/csrf").expect(200);
    const login = await agent.post("/api/auth/login").set("Origin","http://localhost:5173")
      .set("X-CSRF-Token",bootstrap.body.csrfToken).send({ email: f.staff.email, password }).expect(200);
    await agent.get(url).expect(200);
    for (const headers of [{ Origin: "http://localhost:5173" }, { Origin: "http://evil.example", "X-CSRF-Token": login.body.csrfToken }]) {
      const denied = await agent.post(url).set(headers).send(createBody()).expect(403);
      expect(denied.body.code).toBe("CSRF_INVALID");
      expect(denied.headers["cache-control"]).toBe("no-store");
    }
    await agent.post(url).set("Origin","http://localhost:5173").set("X-CSRF-Token",login.body.csrfToken).send(createBody()).expect(201);
  });
  it.each(["anonymous","expired","revoked","inactive","restricted"])("enforces %s session on Action routes", async state => {
    const f = await fixture(), url = actionsPath(f.ticket.id);
    if (state === "expired") await db.session.updateMany({ where: { userId: f.staff.id }, data: { expiresAt: new Date(0) } });
    if (state === "revoked") await db.session.deleteMany({ where: { userId: f.staff.id } });
    if (state === "inactive") await db.user.update({ where: { id: f.staff.id }, data: { isActive: false } });
    if (state === "restricted") await db.user.update({ where: { id: f.staff.id }, data: { mustChangePassword: true } });
    for (const [method,path] of [["get",url],["post",url],["patch",url + "/1"],["post",url + "/1/transitions"],
      ["get",url + "/1/history"],["get","/api/staff/actions?assigneeId=me&state=outstanding"]] as const) {
      const r = await request(app)[method](path).set(state === "anonymous" ? {} : f.staffHeaders).send({}).expect(state === "restricted" ? 403 : 401);
      expect(r.body.code).toBe(state === "restricted" ? "PASSWORD_CHANGE_REQUIRED" : "UNAUTHENTICATED");
    }
  });
  it("rejects unsupported methods after resource and role checks without deleting history", async () => {
    const f = await fixture(), url = actionsPath(f.ticket.id);
    const a = (await request(app).post(url).set(f.staffHeaders).send(createBody()).expect(201)).body.action;
    for (const [method,path] of [["delete",url + "/" + a.id],["patch",url + "/" + a.id + "/history"],["put",url],["get",url + "/" + a.id + "/transitions"]] as const) {
      expect((await request(app)[method](path).set(f.staffHeaders).send({}).expect(405)).body.code).toBe("METHOD_NOT_ALLOWED");
    }
    await request(app).delete(url + "/" + a.id).set(f.otherHeaders).send({}).expect(403);
    expect(await db.actionTakenRevision.count({ where: { actionId: a.id } })).toBe(1);
  });
  it("rejects invalid path/query/body shapes, oversized and malformed JSON safely", async () => {
    const f = await fixture(), url = actionsPath(f.ticket.id);
    await request(app).get("/api/tickets/01/actions").set(f.staffHeaders).expect(400);
    await request(app).get(url).set(f.staffHeaders).send({ requesterId: f.requester.id }).expect(400);
    await request(app).post(url + "?requesterId=1").set(f.staffHeaders).send(createBody()).expect(400);
    const malformed = await request(app).post(url).set(f.staffHeaders).set("Content-Type","application/json").send("{").expect(400);
    expect(malformed.body.code).toBe("VALIDATION_ERROR");
    const large = await request(app).post(url).set(f.staffHeaders).send(createBody({ description: "x".repeat(140000) })).expect(413);
    expect(large.body.code).toBe("PAYLOAD_TOO_LARGE");
    expect(large.headers["cache-control"]).toBe("no-store");
  });
});
