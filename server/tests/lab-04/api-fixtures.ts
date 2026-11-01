import request from "supertest";
import { app } from "../../src/app.js";
import { afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../../src/prisma.js";
import { requesterHeaders } from "../lab-03/legacy-session.js";
import type { UserRole } from "@prisma/client";

export const db = getPrisma();
const users: number[] = [], tickets: number[] = [];
export async function fixture() {
  const makeUser = async (role: UserRole, isActive = true) => {
    const email = randomUUID() + "@example.com";
    const u = await db.user.create({ data: { email, emailNormalized: email, name: role,
      role, isActive, passwordHash: "test-only", mustChangePassword: false } });
    users.push(u.id); return u;
  };
  const requester = await makeUser("REQUESTER"), other = await makeUser("REQUESTER");
  const staff = await makeUser("IT_STAFF"), colleague = await makeUser("IT_STAFF");
  const admin = await makeUser("ADMINISTRATOR"), inactive = await makeUser("IT_STAFF", false);
  const category = await db.category.findFirstOrThrow(), system = await db.relatedSystem.findFirstOrThrow();
  const makeTicket = async (requesterId = requester.id) => {
    const t = await db.ticket.create({ data: { ticketNumber: "L4-" + randomUUID(), summary: "Actions",
      description: "Fixture", requesterId, categoryId: category.id, relatedSystemId: system.id } });
    tickets.push(t.id); return t;
  };
  const ticket = await makeTicket();
  return { requester, other, staff, colleague, admin, inactive, ticket, makeTicket,
    staffHeaders: await requesterHeaders(staff.id), adminHeaders: await requesterHeaders(admin.id),
    requesterHeaders: await requesterHeaders(requester.id), otherHeaders: await requesterHeaders(other.id),
    colleagueHeaders: await requesterHeaders(colleague.id) };
}
export const actionsPath = (ticketId: number) => "/api/tickets/" + ticketId + "/actions";
export const createBody = (extra: object = {}) => ({
  clientRequestId: randomUUID(), expectedWorkflowVersion: 1, description: " Work ", ...extra,
});
export const versions = (response: any) => ({
  expectedWorkflowVersion: response.ticket.workflowVersion, expectedVersion: response.action.version,
});
afterEach(async () => {
  await db.actionTakenRevision.deleteMany({ where: { action: { ticketId: { in: tickets } } } });
  await db.actionTaken.deleteMany({ where: { ticketId: { in: tickets } } });
  await db.ticket.deleteMany({ where: { id: { in: tickets } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  tickets.length = 0; users.length = 0;
});

export async function completed(f: Awaited<ReturnType<typeof fixture>>, followUpRequired = false) {
  let r = (await request(app).post(actionsPath(f.ticket.id)).set(f.staffHeaders).send(createBody()).expect(201)).body;
  const url = actionsPath(f.ticket.id) + "/" + r.action.id + "/transitions";
  r = (await request(app).post(url).set(f.staffHeaders).send({ ...versions(r), targetStatus: "IN_PROGRESS" }).expect(200)).body;
  return (await request(app).post(url).set(f.staffHeaders).send({ ...versions(r), targetStatus: "COMPLETED", result: "Fixed", followUpRequired,
    ...(followUpRequired ? { followUpNote: "Check tomorrow" } : {}) }).expect(200)).body;
}
