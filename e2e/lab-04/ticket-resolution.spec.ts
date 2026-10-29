import type { Page } from '@playwright/test';
import { test as base, expect, db, login, ticket } from '../lab-03/fixtures.js';

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
async function open(page: Page, id: number) {
  await page.goto(`/#/tickets/${id}`); await expect(page.getByRole('button', { name: 'Refresh Actions' })).toBeEnabled();
}
async function saved(page: Page, label: string, suffix: string, method = 'PATCH', dialog = false) {
  const response = page.waitForResponse(r => new URL(r.url()).pathname.endsWith(suffix) && r.request().method() === method);
  await (dialog ? page.getByRole('dialog') : page).getByRole('button', { name: label, exact: true }).click();
  const result = await response; expect(result.status(), await result.text()).toBeLessThan(300);
  expect(result.request().postDataJSON().expectedWorkflowVersion).toBeGreaterThan(0);
  if (dialog) await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh Actions' })).toBeEnabled();
  return result.json();
}
async function status(page: Page, to: string, reason?: string) {
  await page.getByLabel('Next Status').selectOption(to);
  if (['RESOLVED','CLOSED','REOPENED','CANCELLED'].includes(to)) {
    await page.getByRole('button', { name: 'Update Status' }).click();
    if (reason) await page.getByLabel('Transition reason').fill(reason);
    return saved(page, 'Confirm Status Change', '/status', 'PATCH', true);
  }
  return saved(page, 'Update Status', '/status');
}
async function createAction(page: Page, text: string) {
  await page.getByRole('button', { name: 'Create Action', exact: true }).click();
  await page.getByLabel('Description (required)').fill(text);
  return saved(page, 'Create Action', '/actions', 'POST', true);
}
const actionCard = (page: Page, id: number) => page.locator(`[aria-labelledby="action-title-${id}"]`);

test('L4-E2E-02 versioned ownership, advisory, Actions gate, resolve/close/reopen and cancellation', async ({ page, browser, actors }) => {
  const parent = await ticket(actors.requester);
  await login(page, actors.staff); await open(page, parent.id);
  await saved(page, 'Claim Ticket', '/claim', 'POST');
  await page.getByLabel('Assign Owner').selectOption(String(actors.admin.id)); await saved(page, 'Save Owner', '/owner');
  await page.getByLabel('Assign Owner').selectOption(String(actors.staff.id)); await saved(page, 'Save Owner', '/owner');
  await page.getByLabel('IT Priority', { exact: true }).selectOption('CRITICAL'); await saved(page, 'Save Priority', '/priority');
  await status(page, 'OPEN'); await status(page, 'IN_PROGRESS');
  await expect(page.getByRole('option', { name: 'Resolve (RESOLVED)' })).toBeDisabled();
  const requesterContext = await browser.newContext({ baseURL: 'http://localhost:5174' });
  try {
    const requesterPage = await requesterContext.newPage(); await login(requesterPage, actors.requester); await open(requesterPage, parent.id);
    await requesterPage.getByRole('button', { name: 'Problem Appears Resolved' }).click();
    const response = requesterPage.waitForResponse(r => r.url().endsWith('/resolution-indication') && r.request().method() === 'POST');
    await requesterPage.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    const indication = await response; expect(indication.status()).toBe(200); expect(indication.request().postDataJSON()).toEqual({ expectedCycle: 1 });
    expect((await indication.json()).currentStatus).toBe('IN_PROGRESS');
  } finally { await requesterContext.close(); }
  await page.getByRole('button', { name: 'Refresh Actions' }).click();
  await expect(page.getByText(/Requester Resolution Notice:/)).toBeVisible();
  const created = await createAction(page, 'Repair current cycle'); const id = created.action.id;
  await actionCard(page, id).getByRole('button', { name: 'Start Action' }).click(); await saved(page, 'Start Action', '/transitions', 'POST', true);
  await actionCard(page, id).getByRole('button', { name: 'Complete Action' }).click();
  await page.getByLabel('Result (required)').fill('Repaired'); await page.getByLabel('Follow-up required', { exact: true }).check();
  await page.getByLabel('Follow-up note (required)').fill('Verify stability'); await saved(page, 'Complete Action', '/transitions', 'POST', true);
  await expect(page.getByRole('option', { name: 'Resolve (RESOLVED)' })).toBeDisabled();
  await expect(page.getByText(/Outstanding completed-Action follow-ups: 1/)).toBeVisible();
  await actionCard(page, id).getByRole('button', { name: 'Correct Action' }).click();
  await page.getByLabel('Follow-up required', { exact: true }).uncheck(); await page.getByLabel('Change reason (required)').fill('Stability confirmed');
  await saved(page, 'Save Action', '/actions/' + id, 'PATCH', true);
  await expect(page.getByRole('option', { name: 'Resolve (RESOLVED)' })).toBeEnabled();
  const resolved = await status(page, 'RESOLVED'); expect(resolved.resolvedAt).not.toBeNull();
  await status(page, 'CLOSED'); const reopened = await status(page, 'REOPENED', 'Problem returned');
  expect(reopened).toMatchObject({ workCycle: 2, resolvedAt: null, resolutionSuggestedAt: null, resolutionSuggestedById: null });
  await expect(page.getByRole('heading', { name: 'Work cycle 1 — Historical' })).toBeVisible();
  await expect(actionCard(page, id).getByRole('button', { name: 'Correct Action' })).toHaveCount(0);
  await status(page, 'OPEN'); await status(page, 'IN_PROGRESS');
  await expect(page.getByRole('option', { name: 'Resolve (RESOLVED)' })).toBeDisabled();
  const unfinished = await createAction(page, 'Unfinished new-cycle work');
  await expect(page.getByRole('option', { name: 'Cancel (CANCELLED)' })).toBeDisabled();
  await actionCard(page, unfinished.action.id).getByRole('button', { name: 'Cancel Action' }).click();
  await page.getByLabel('Cancellation reason (required)').fill('No longer required'); await saved(page, 'Confirm cancellation', '/transitions', 'POST', true);
  await expect(page.getByRole('option', { name: 'Cancel (CANCELLED)' })).toBeEnabled();
  await status(page, 'CANCELLED', 'Request withdrawn');
  await expect(page.getByLabel('Next Status')).toHaveCount(0);
  expect((await db.publicComment.findMany({ where: { ticketId: parent.id } })).map(c => c.body)).toEqual(expect.arrayContaining(['Problem returned','Request withdrawn']));
  const legacy = await ticket(actors.requester, { currentStatus: 'RESOLVED' }); await open(page, legacy.id);
  await status(page, 'CLOSED'); expect(await db.actionTaken.count({ where: { ticketId: legacy.id } })).toBe(0);
});

test('real stale priority and advisory-cycle recovery require review and never change formal status implicitly', async ({ page, browser, actors }) => {
  const parent = await ticket(actors.requester, { currentStatus: 'RESOLVED', ownerId: actors.staff.id });
  await login(page, actors.staff); await open(page, parent.id);
  const context = await browser.newContext({ baseURL: 'http://localhost:5174' });
  try {
    const adminPage = await context.newPage(); await login(adminPage, actors.admin); await open(adminPage, parent.id);
    await adminPage.getByLabel('IT Priority', { exact: true }).selectOption('LOW');
    await status(page, 'REOPENED', 'Start new cycle');
    const conflict = adminPage.waitForResponse(r => r.url().endsWith('/priority') && r.request().method() === 'PATCH');
    await adminPage.getByRole('button', { name: 'Save Priority' }).click(); expect((await conflict).status()).toBe(409);
    await adminPage.getByRole('button', { name: 'Reload latest workflow' }).click();
    await expect(adminPage.getByRole('button', { name: 'Use latest workflow after review' })).toBeVisible();
    await expect(adminPage.getByLabel('IT Priority', { exact: true })).toHaveValue('LOW');
    await expect(adminPage.getByRole('button', { name: 'Save Priority' })).toBeDisabled();
    await adminPage.getByRole('button', { name: 'Use latest workflow after review' }).click(); await saved(adminPage, 'Save Priority', '/priority');
  } finally { await context.close(); }
  const requesterContext = await browser.newContext({ baseURL: 'http://localhost:5174' });
  try {
    const requesterPage = await requesterContext.newPage(); await login(requesterPage, actors.requester); await open(requesterPage, parent.id);
    await requesterPage.getByRole('button', { name: 'Problem Appears Resolved' }).click();
    // Isolated fixture advances to another active cycle while this confirmation stays open.
    await db.ticket.update({ where: { id: parent.id }, data: { workCycle: 3, workflowVersion: { increment: 1 } } });
    const conflict = requesterPage.waitForResponse(r => r.url().endsWith('/resolution-indication') && r.request().method() === 'POST');
    await requesterPage.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    const rejected = await conflict; expect(rejected.status()).toBe(409); expect((await rejected.json()).code).toBe('TICKET_CYCLE_CONFLICT');
    await requesterPage.getByRole('button', { name: 'Reload latest workflow' }).click();
    await expect(requesterPage.getByRole('button', { name: 'Use latest workflow after review' })).toBeVisible();
    await expect(requesterPage.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true })).toBeDisabled();
    await requesterPage.getByRole('button', { name: 'Use latest workflow after review' }).click();
    const retry = requesterPage.waitForResponse(r => r.url().endsWith('/resolution-indication') && r.request().method() === 'POST');
    await requesterPage.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    const response = await retry; expect(response.status()).toBe(200); expect(response.request().postDataJSON()).toEqual({ expectedCycle: 3 });
    expect((await response.json()).currentStatus).toBe('REOPENED');
  } finally { await requesterContext.close(); }
});
