import { test as base, expect, type Page, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPrisma } from '../../server/src/prisma.js';
import { hashPassword } from '../../server/src/auth/password.js';
export { expect };
export const apiURL = 'http://localhost:3101';
export const origin = 'http://localhost:5174';
const database = new URL(process.env.DATABASE_URL ?? '');
if (database.hostname !== '127.0.0.1' || database.port !== '55433' || database.pathname !== '/toktickit_lab3_test')
  throw new Error('Browser fixtures require the isolated Lab 3 database.');
const serverRoot = fileURLToPath(new URL('../../server/', import.meta.url));
const uploadRoot = path.resolve(serverRoot, 'uploads/lab-03-test');
export const db = getPrisma();
export type Account = { id: number; name: string; email: string; password: string };
type Actors = { requester: Account; other: Account; staff: Account; admin: Account; initial: Account };
export const test = base.extend<{ actors: Actors }>({
  actors: async ({}, use) => {
    const roles = { requester: 'REQUESTER', other: 'REQUESTER', staff: 'IT_STAFF', admin: 'ADMINISTRATOR', initial: 'REQUESTER' } as const;
    const actors = {} as Actors;
    for (const key of Object.keys(roles) as (keyof Actors)[]) {
      const password = 'Browser ' + randomUUID(), email = randomUUID() + '@example.com';
      const user = await db.user.create({ data: { name: 'Browser ' + key, email, emailNormalized: email, role: roles[key],
        passwordHash: await hashPassword(password), mustChangePassword: key === 'initial' } });
      actors[key] = { id: user.id, name: user.name, email, password };
    }
    try { await use(actors); } finally {
      const ids = Object.values(actors).map(actor => actor.id);
      const attachments = await db.attachment.findMany({ where: { ticket: { requesterId: { in: ids } } }, select: { storedPath: true } });
      for (const attachment of attachments) {
        const file = path.resolve(serverRoot, attachment.storedPath);
        if (!file.startsWith(uploadRoot + path.sep)) throw new Error('Refusing cleanup outside the isolated upload root.');
        await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
      }
      await db.ticket.deleteMany({ where: { requesterId: { in: ids } } });
      await db.publicComment.deleteMany({ where: { authorId: { in: ids } } });
      await db.internalNote.deleteMany({ where: { authorId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
    }
  },
});
export async function login(page: Page, user: Account) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
}
export async function csrf(request: APIRequestContext) {
  return (await (await request.get(apiURL + '/api/auth/csrf')).json()).csrfToken as string;
}
export async function mutation(request: APIRequestContext, method: string, path: string, data: unknown = {}) {
  return request.fetch(apiURL + '/api' + path, { method, headers: { Origin: origin, 'X-CSRF-Token': await csrf(request) }, data });
}
export async function ticket(requester: Account, extra: Record<string, unknown> = {}) {
  const category = await db.category.findFirstOrThrow(), system = await db.relatedSystem.findFirstOrThrow();
  return db.ticket.create({ data: { ticketNumber: 'BROWSER-' + randomUUID(), summary: 'Browser verification ticket', description: 'Integrated ticket details',
    requesterId: requester.id, categoryId: category.id, relatedSystemId: system.id, requestedPriority: 'HIGH', itPriority: 'HIGH', ...extra } });
}
export async function navigate(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  if (await page.getByRole('button', { name: 'Menu', exact: true }).isVisible()) await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await button.click();
}
export async function noOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}
