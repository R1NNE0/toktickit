import { afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app } from '../../src/app.js';
import { getPrisma } from '../../src/prisma.js';
import { hashPassword } from '../../src/auth/password.js';

// API-04/05/06/07/26: real login cookies across every implemented business route.
const routes = [
  ['get', '/api/tickets', ['REQUESTER']], ['post', '/api/tickets', ['REQUESTER']],
  ['get', '/api/tickets/2147483647', ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR']],
  ['post', '/api/tickets/2147483647/attachments', ['REQUESTER', 'IT_STAFF']],
  ['get', '/api/attachments/2147483647/download', ['REQUESTER', 'IT_STAFF']],
  ['delete', '/api/attachments/2147483647', ['REQUESTER', 'IT_STAFF']],
  ['get', '/api/staff/tickets', ['IT_STAFF']], ['get', '/api/staff/assignees', ['IT_STAFF']],
  ['get', '/api/staff/tickets/2147483647', ['IT_STAFF']], ['post', '/api/staff/tickets/2147483647/claim', ['IT_STAFF']],
  ['patch', '/api/staff/tickets/2147483647/owner', ['IT_STAFF']],
  ['patch', '/api/staff/tickets/2147483647/priority', ['IT_STAFF', 'ADMINISTRATOR']],
  ['patch', '/api/staff/tickets/2147483647/status', ['IT_STAFF']],
  ['get', '/api/tickets/2147483647/comments', ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR']],
  ['post', '/api/tickets/2147483647/comments', ['REQUESTER', 'IT_STAFF']],
  ['get', '/api/tickets/2147483647/notes', ['IT_STAFF', 'ADMINISTRATOR']],
  ['post', '/api/tickets/2147483647/notes', ['IT_STAFF']],
  ['post', '/api/tickets/2147483647/resolution-indication', ['REQUESTER']],
  ['get', '/api/admin/users', ['ADMINISTRATOR']], ['post', '/api/admin/users', ['ADMINISTRATOR']],
  ['patch', '/api/admin/users/2147483647', ['ADMINISTRATOR']],
  ['post', '/api/admin/users/2147483647/initial-password', ['ADMINISTRATOR']],
] as const;
type Role = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
const db = getPrisma(), origin = 'http://localhost:5173';
const password = 'Integration ' + randomUUID();
const ids: number[] = [];
async function account(role: Role, mustChangePassword = false) {
  const email = randomUUID() + '@example.com';
  const user = await db.user.create({ data: { name: 'Integration ' + role, email, emailNormalized: email, role,
    mustChangePassword, passwordHash: await hashPassword(password) } });
  ids.push(user.id); return user;
}
async function login(email: string) {
  const agent = request.agent(app), boot = await agent.get('/api/auth/csrf').expect(200);
  const result = await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', boot.body.csrfToken).send({ email, password }).expect(200);
  return { agent, csrf: result.body.csrfToken as string };
}
describe('Issue 35 integrated authorization and account lifecycle', () => {
  afterAll(async () => {
    await db.ticket.deleteMany({ where: { requesterId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });
  it.each(['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'] as const)('enforces all role denials after real %s login', async role => {
    const user = await account(role), { agent, csrf } = await login(user.email);
    for (const [method, path, allowed] of routes) {
      if ((allowed as readonly string[]).includes(role)) continue;
      const response = await agent[method](path).set('Origin', origin).set('X-CSRF-Token', csrf).send({});
      expect(response.status, method + ' ' + path).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|tokenHash|internalNotes|stack|SELECT /);
    }
  });
  it('rejects anonymous legacy headers across all business routes', async () => {
    for (const [method, path] of routes) {
      const response = await request(app)[method](path).set('x-requester-id', '1').send({});
      expect(response.status, method + ' ' + path).toBe(401);
    }
  });
  it.each(['restricted', 'inactive', 'expired', 'revoked'] as const)('rejects %s cookies across every route', async state => {
    const user = await account('ADMINISTRATOR', state === 'restricted'), { agent, csrf } = await login(user.email);
    if (state === 'inactive') await db.user.update({ where: { id: user.id }, data: { isActive: false } });
    if (state === 'expired') await db.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(0) } });
    if (state === 'revoked') await db.session.deleteMany({ where: { userId: user.id } });
    for (const [method, path] of routes) {
      const response = await agent[method](path).set('Origin', origin).set('X-CSRF-Token', csrf).send({});
      expect(response.status, method + ' ' + path).toBe(state === 'restricted' ? 403 : 401);
      expect(response.body.code).toBe(state === 'restricted' ? 'PASSWORD_CHANGE_REQUIRED' : 'UNAUTHENTICATED');
    }
  });
  it('requires CSRF on every new mutation family even for authorized accounts', async () => {
    for (const role of ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'] as const) {
      const user = await account(role), { agent } = await login(user.email);
      for (const [method, path, allowed] of routes) {
        if (method === 'get' || !(allowed as readonly string[]).includes(role)) continue;
        const response = await agent[method](path).set('Origin', origin).send({});
        expect(response.status, method + ' ' + path).toBe(403); expect(response.body.code).toBe('CSRF_INVALID');
      }
    }
  });
  it('connects Requester creation, Staff communication, Admin reads and role-change revocation without leaking notes', async () => {
    const users = await Promise.all([account('REQUESTER'), account('REQUESTER'), account('IT_STAFF'), account('ADMINISTRATOR')]);
    const [owner, other, staff, admin] = await Promise.all(users.map(user => login(user.email)));
    const category = await db.category.findFirstOrThrow(), system = await db.relatedSystem.findFirstOrThrow();
    const made = await owner.agent.post('/api/tickets').set('Origin', origin).set('X-CSRF-Token', owner.csrf)
      .send({ summary: 'Integrated request', description: 'Private owned request', categoryId: category.id, relatedSystemId: system.id, requestedPriority: 'HIGH' }).expect(201);
    const id = made.body.id;
    await staff.agent.post(`/api/tickets/${id}/notes`).set('Origin', origin).set('X-CSRF-Token', staff.csrf).send({ body: 'PRIVATE-NOTE-SENTINEL' }).expect(201);
    await staff.agent.post(`/api/tickets/${id}/comments`).set('Origin', origin).set('X-CSRF-Token', staff.csrf).send({ body: 'Public reply' }).expect(201);
    for (const url of ['/api/tickets', `/api/tickets/${id}`, `/api/tickets/${id}/comments`]) {
      const response = await owner.agent.get(url).expect(200);
      expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE-NOTE-SENTINEL|internalNotes|noteCount/);
    }
    const hidden = await other.agent.get(`/api/tickets/${id}/comments`).expect(404);
    const absent = await other.agent.get('/api/tickets/2147483647/comments').expect(404);
    expect(hidden.body).toEqual(absent.body);
    await owner.agent.get(`/api/tickets/${id}/notes`).expect(403);
    expect((await admin.agent.get(`/api/tickets/${id}/notes`).expect(200)).body.data[0].body).toBe('PRIVATE-NOTE-SENTINEL');
    await admin.agent.patch(`/api/staff/tickets/${id}/priority`).set('Origin', origin).set('X-CSRF-Token', admin.csrf).send({ itPriority: 'CRITICAL' }).expect(200);
    await admin.agent.patch(`/api/admin/users/${users[2].id}`).set('Origin', origin).set('X-CSRF-Token', admin.csrf).send({ role: 'REQUESTER' }).expect(200);
    await staff.agent.get('/api/staff/tickets').expect(401);
    const fresh = await login(users[2].email);
    await fresh.agent.get('/api/staff/tickets').expect(403);
    expect((await owner.agent.get(`/api/tickets/${id}`).expect(200)).body).toMatchObject({ requestedPriority: 'HIGH', itPriority: 'CRITICAL' });
  });
});
