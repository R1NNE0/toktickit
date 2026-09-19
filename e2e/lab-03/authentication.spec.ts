import { test, expect, login, mutation, apiURL } from './fixtures.js';
import { randomUUID } from 'node:crypto';
test('E2E-01 initial login is restricted, password change rotates access, logout revokes it', async ({ page, actors }) => {
  await login(page, actors.initial);
  await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();
  expect((await page.request.get(apiURL + '/api/tickets')).status()).toBe(403);
  const repeated = await mutation(page.request, 'POST', '/auth/login', { email: actors.initial.email, password: actors.initial.password });
  expect(repeated.status()).toBe(403); expect((await repeated.json()).code).toBe('PASSWORD_CHANGE_REQUIRED');
  const changed = 'Changed ' + randomUUID();
  await page.getByLabel('Current password', { exact: true }).fill(actors.initial.password);
  await page.getByLabel('New password', { exact: true }).fill(changed);
  await page.getByLabel('Confirm new password').fill(changed);
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page.getByRole('button', { name: 'My Tickets', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('button', { name: 'My Tickets', exact: true })).toBeVisible();
  await page.goto('/#/tickets/2147483647');
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect((await page.request.get(apiURL + '/api/tickets')).status()).toBe(401);
  await page.goBack(); await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
test('E2E-01 wrong and inactive credentials produce the same safe login feedback', async ({ page, actors }) => {
  const { db } = await import('./fixtures.js');
  await db.user.update({ where: { id: actors.other.id }, data: { isActive: false } });
  await page.goto('/');
  for (const [email, password] of [[actors.requester.email, 'Incorrect synthetic password'], [actors.other.email, actors.other.password]]) {
    await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(/Unable to sign in/);
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
  }
});
