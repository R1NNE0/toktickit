import { test, expect, login, ticket, apiURL, db } from './fixtures.js';
test('E2E-02 Staff queue, ownership, discussion, resolution cycle and Requester visibility', async ({ page, browser, actors }) => {
  const work = await ticket(actors.requester);
  for (let i = 0; i < 11; i++) await ticket(actors.requester, { summary: 'Queue page fixture ' + i });
  await login(page, actors.staff);
  await page.getByLabel('Search tickets').fill('Queue page fixture');
  await expect(page.getByText('11 matching tickets')).toBeVisible();
  await page.getByRole('button', { name: 'Next Page' }).click(); await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await page.getByRole('button', { name: /^Open Detail/ }).first().click();
  await page.getByRole('button', { name: 'Back to Ticket Queue' }).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Clear Filters' }).click();
  await page.getByLabel('Search tickets').fill(work.ticketNumber);
  await page.getByRole('combobox', { name: /^Owner/ }).selectOption('unassigned');
  await page.getByLabel('Sort By').selectOption('itPriority'); await page.getByLabel('Direction').selectOption('asc');
  await page.getByRole('button', { name: 'Open Detail ' + work.ticketNumber, exact: true }).click();
  await page.getByRole('button', { name: 'Claim Ticket', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'successfully claimed' })).toBeVisible();
  await page.getByLabel('Assign Owner').selectOption(String(actors.admin.id));
  await page.getByRole('button', { name: 'Save Owner' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'owner updated' })).toBeVisible();
  await page.getByLabel('IT Priority', { exact: true }).selectOption('CRITICAL');
  await page.getByRole('button', { name: 'Save Priority' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'IT Priority updated' })).toBeVisible();
  async function transition(status: string, reason?: string) {
    await page.getByLabel('Next Status').selectOption(status); await page.getByRole('button', { name: 'Update Status', exact: true }).click();
    if (['RESOLVED', 'CLOSED', 'REOPENED'].includes(status)) {
      if (reason) await page.getByLabel('Transition reason').fill(reason);
      await page.getByRole('button', { name: 'Confirm Status Change', exact: true }).click();
    }
    await expect.poll(async () => (await db.ticket.findUniqueOrThrow({ where: { id: work.id } })).currentStatus).toBe(status);
  }
  await transition('OPEN'); await transition('IN_PROGRESS'); await transition('WAITING_FOR_REQUESTER');
  await page.getByLabel('Public comment', { exact: true }).fill('Please confirm this fix'); await page.getByRole('button', { name: 'Post Comment', exact: true }).click();
  await page.getByLabel('Internal note', { exact: true }).fill('PRIVATE browser diagnosis'); await page.getByRole('button', { name: 'Post Internal Note' }).click();
  await expect(page.getByText('PRIVATE browser diagnosis', { exact: true })).toBeVisible();
  await page.getByLabel('Add Attachment').setInputFiles({ name: 'staff.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 staff') });
  await expect(page.getByText('staff.pdf', { exact: true })).toBeVisible();
  const context = await browser.newContext({ baseURL: 'http://localhost:5174' }), requester = await context.newPage();
  try {
    await login(requester, actors.requester); await requester.goto('/#/tickets/' + work.id);
    await expect(requester.getByText('Please confirm this fix', { exact: true })).toBeVisible();
    await expect(requester.getByText('PRIVATE browser diagnosis')).toHaveCount(0);
    expect((await requester.request.get(apiURL + `/api/tickets/${work.id}/notes`)).status()).toBe(403);
    await requester.getByRole('button', { name: 'Problem Appears Resolved', exact: true }).click();
    await requester.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(requester.getByRole('button', { name: 'Resolution Indicated' })).toBeDisabled();
    expect((await db.ticket.findUniqueOrThrow({ where: { id: work.id } })).currentStatus).toBe('WAITING_FOR_REQUESTER');
    await transition('RESOLVED'); await transition('CLOSED'); await transition('REOPENED', 'Problem returned after testing');
    await requester.reload(); await expect(requester.getByRole('button', { name: 'Problem Appears Resolved', exact: true })).toBeEnabled();
    expect((await db.ticket.findUniqueOrThrow({ where: { id: work.id } })).resolutionSuggestedAt).toBeNull();
  } finally { await context.close(); }
  await page.getByRole('button', { name: 'Back to Ticket Queue' }).click();
  await expect(page.getByLabel('Search tickets')).toHaveValue(work.ticketNumber);
  await expect(page.getByLabel('Sort By')).toHaveValue('itPriority');
  await expect(page.getByLabel('Direction')).toHaveValue('asc');
  await expect(page.getByText('0 matching tickets')).toBeVisible(); // Claimed ticket no longer matches Unassigned.
});
