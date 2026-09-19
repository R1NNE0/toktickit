import { test, expect, login, ticket, apiURL, mutation, db } from './fixtures.js';
import { randomUUID } from 'node:crypto';
test('E2E-03 account create/edit/reset, mandatory change, deactivation and safety', async ({ page, browser, actors }) => {
  await login(page, actors.admin);
  const email = randomUUID() + '@example.com', initial = 'Initial ' + randomUUID(), reset = 'Reset ' + randomUUID();
  let createdId: number | undefined;
  const context = await browser.newContext({ baseURL: 'http://localhost:5174' }), userPage = await context.newPage();
  try {
    await page.getByRole('button', { name: 'Create User', exact: false }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full Name', { exact: false }).fill('Browser managed account');
    await dialog.getByLabel('Email Address', { exact: false }).fill(email);
    await dialog.getByLabel('Initial Password', { exact: false }).fill(initial);
    await dialog.getByRole('button', { name: 'Create User', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'created successfully' })).toBeVisible();
    createdId = (await db.user.findUniqueOrThrow({ where: { emailNormalized: email } })).id;
    await page.getByRole('button', { name: 'Create User', exact: false }).click();
    await dialog.getByLabel('Full Name', { exact: false }).fill('Duplicate account');
    await dialog.getByLabel('Email Address', { exact: false }).fill(email);
    await dialog.getByLabel('Initial Password', { exact: false }).fill(initial);
    await dialog.getByRole('button', { name: 'Create User', exact: true }).click();
    await expect(dialog.getByText('A user with this email address already exists.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await login(userPage, { id: createdId, name: 'Browser managed account', email, password: initial });
    await expect(userPage.getByRole('heading', { name: 'Change password' })).toBeVisible();
    await page.getByLabel('Search users').fill(email);
    await page.getByRole('button', { name: 'Edit user Browser managed account', exact: true }).click();
    await dialog.getByLabel('Full Name', { exact: false }).fill('Browser edited account');
    await dialog.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'updated successfully' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit user Browser edited account' }).click();
    await dialog.getByRole('button', { name: 'Set New Initial Password' }).click();
    await dialog.getByLabel('New Initial Password', { exact: false }).fill(reset);
    await dialog.getByRole('button', { name: 'Set Initial Password', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'New initial password set' })).toBeVisible();
    expect((await userPage.request.get(apiURL + '/api/auth/me')).status()).toBe(401);
    await login(userPage, { id: createdId, name: '', email, password: reset });
    await userPage.getByLabel('Current password', { exact: true }).fill(reset);
    const changed = 'Changed ' + randomUUID();
    await userPage.getByLabel('New password', { exact: true }).fill(changed); await userPage.getByLabel('Confirm new password').fill(changed);
    await userPage.getByRole('button', { name: 'Save password' }).click();
    await expect(userPage.getByRole('button', { name: 'My Tickets', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Edit user Browser edited account' }).click();
    await dialog.getByLabel('Role', { exact: false }).selectOption('IT_STAFF');
    await dialog.getByRole('button', { name: 'Save Changes' }).click();
    await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { id: createdId } })).role).toBe('IT_STAFF');
    expect((await userPage.request.get(apiURL + '/api/tickets')).status()).toBe(401);
    await login(userPage, { id: createdId, name: '', email, password: changed });
    await expect(userPage.getByRole('heading', { name: 'IT Staff Ticket Queue' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit user Browser edited account' }).click();
    await dialog.getByLabel('Active Account').uncheck(); await dialog.getByRole('button', { name: 'Save Changes' }).click();
    await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { id: createdId } })).isActive).toBe(false);
    expect((await userPage.request.get(apiURL + '/api/tickets')).status()).toBe(401);
    expect((await mutation(page.request, 'PATCH', `/admin/users/${actors.admin.id}`, { isActive: false })).status()).toBe(409);
    const admins = await db.user.findMany({ where: { role: 'ADMINISTRATOR', isActive: true, id: { not: actors.admin.id } } });
    try {
      await db.user.updateMany({ where: { id: { in: admins.map(user => user.id) } }, data: { isActive: false } });
      const last = await mutation(page.request, 'PATCH', `/admin/users/${actors.admin.id}`, { role: 'REQUESTER' });
      expect(last.status()).toBe(409); expect((await last.json()).code).toBe('LAST_ADMIN');
    } finally { await db.user.updateMany({ where: { id: { in: admins.map(user => user.id) } }, data: { isActive: true } }); }
  } finally { await context.close(); if (createdId) await db.user.delete({ where: { id: createdId } }); }
});
test('E2E-05 Administrator may read ticket discussions and edit IT Priority without Staff inheritance', async ({ page, actors }) => {
  const work = await ticket(actors.requester, { ownerId: actors.staff.id });
  await db.publicComment.create({ data: { ticketId: work.id, authorId: actors.staff.id, body: 'Visible public entry' } });
  await db.internalNote.create({ data: { ticketId: work.id, authorId: actors.staff.id, body: 'Visible internal entry' } });
  await login(page, actors.admin); await page.goto('/#/tickets/' + work.id);
  await expect(page.getByText('Visible public entry')).toBeVisible(); await expect(page.getByText('Visible internal entry')).toBeVisible();
  await page.getByLabel('IT Priority', { exact: true }).selectOption('LOW'); await page.getByRole('button', { name: 'Save Priority' }).click();
  await expect.poll(async () => (await db.ticket.findUniqueOrThrow({ where: { id: work.id } })).itPriority).toBe('LOW');
  expect((await db.ticket.findUniqueOrThrow({ where: { id: work.id } })).requestedPriority).toBe('HIGH');
  for (const path of ['/staff/tickets', '/staff/assignees', `/staff/tickets/${work.id}`, '/attachments/2147483647/download'])
    expect((await page.request.get(apiURL + '/api' + path)).status()).toBe(403);
  for (const [method, path, data] of [
    ['POST', `/staff/tickets/${work.id}/claim`, {}], ['PATCH', `/staff/tickets/${work.id}/owner`, { ownerId: actors.admin.id }],
    ['PATCH', `/staff/tickets/${work.id}/status`, { currentStatus: 'OPEN' }], ['POST', `/tickets/${work.id}/comments`, { body: 'Not allowed' }],
    ['POST', `/tickets/${work.id}/notes`, { body: 'Not allowed' }], ['POST', `/tickets/${work.id}/attachments`, {}],
  ] as const) expect((await mutation(page.request, method, path, data)).status()).toBe(403);
  await expect(page.getByRole('button', { name: /Claim Ticket|Save Owner|Update Status|Post Comment|Post Internal Note/ })).toHaveCount(0);
});
