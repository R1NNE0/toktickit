import { randomUUID } from 'node:crypto';
import { test as base, expect, db, login, ticket, navigate, noOverflow, apiURL } from '../lab-03/fixtures.js';

const test = base.extend<{ actionCleanup: void }>({
  actionCleanup: [async ({ actors }, use) => {
    try { await use(); } finally {
      const where = { ticket: { requesterId: { in: [actors.requester.id, actors.other.id] } } };
      await db.actionTakenRevision.deleteMany({ where: { action: where } });
      await db.actionTaken.deleteMany({ where });
    }
  }, { auto: true }],
});
test.afterAll(async () => { await db.$disconnect(); });

for (const role of ['staff', 'admin'] as const) test(`L4-E2E-03 ${role} dashboard loads real metrics and restores filtered navigation`, async ({ page, actors }) => {
  const actor = actors[role];
  const parent = await ticket(actors.requester, { ownerId: actor.id, currentStatus: 'REOPENED', workCycle: 2 });
  const action = await db.actionTaken.create({ data: { ticketId: parent.id, cycle: 2, description: 'Dashboard assigned work',
    assigneeId: actor.id, createdById: actors.admin.id, clientRequestId: randomUUID(), createRequestHash: '0'.repeat(64) } });
  await login(page, actor);
  await expect(page.getByRole('heading', { name: role === 'staff' ? 'IT Staff Dashboard' : 'Administrator Dashboard', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'My active Tickets 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'My outstanding Actions 1', exact: true })).toBeVisible();
  const response = await page.request.get(apiURL + '/api/dashboard/staff'); expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.metrics.myActiveTickets).toBe(await db.ticket.count({ where: { ownerId: actor.id, currentStatus: { in: ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED'] } } }));
  await page.getByRole('button', { name: 'My active Tickets 1', exact: true }).click();
  await expect(page.getByText('1 matching tickets', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Active queue filters')).toContainText('active; me');
  await page.getByRole('button', { name: `Open Detail ${parent.ticketNumber}`, exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('button', { name: 'Refresh Actions' })).toBeEnabled();
  if (role === 'admin') {
    await expect(page.getByRole('button', { name: 'Claim Ticket', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Next Status', { exact: true })).toHaveCount(0);
  }
  await page.getByRole('button', { name: role === 'admin' ? 'Back' : 'Back to Ticket Queue', exact: true }).click();
  await expect(page.getByText('1 matching tickets', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Owner', exact: true })).toHaveValue('me');
  await navigate(page, 'Dashboard');
  await page.getByRole('button', { name: `Action #${action.id} / ${parent.ticketNumber}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: `Action #${action.id}`, exact: true })).toBeFocused();
  await page.getByRole('button', { name: role === 'admin' ? 'Back' : 'Back to Ticket Queue', exact: true }).click();
  for (const viewport of [{ width: 1280, height: 800 }, { width: 768, height: 1024 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport); await noOverflow(page);
  }
});
