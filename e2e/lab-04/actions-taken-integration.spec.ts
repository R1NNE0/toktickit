import { randomUUID } from 'node:crypto';
import type { Page, APIRequestContext } from '@playwright/test';
import { test as base, expect, db, login, ticket, mutation, apiURL } from '../lab-03/fixtures.js';
import type { ActionMutation } from '../../client/src/actions-api.js';

// The existing actors fixture owns these disposable Tickets. Remove their new
// restricted Action FKs before its original Ticket/User cleanup runs.
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

const actionPath = (id: number) => `/tickets/${id}/actions`;
const versions = (saved: ActionMutation) => ({ expectedWorkflowVersion: saved.ticket.workflowVersion, expectedVersion: saved.action.version });
const card = (page: Page, id: number) => page.locator(`[aria-labelledby="action-title-${id}"]`);
async function openTicket(page: Page, id: number) {
  await page.goto(`/#/tickets/${id}`);
  await expect(page.getByRole('button', { name: 'Refresh Actions' })).toBeEnabled();
}
async function write(request: APIRequestContext, method: string, path: string, body: unknown, status = 200): Promise<ActionMutation> {
  const response = await mutation(request, method, path, body);
  expect(response.status(), await response.text()).toBe(status);
  return response.json();
}
async function submit(page: Page, button: string, path: string, method: string): Promise<ActionMutation> {
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api' + path && r.request().method() === method);
  await page.getByRole('dialog').getByRole('button', { name: button, exact: true }).click();
  const saved = await response;
  expect(saved.ok(), await saved.text()).toBe(true);
  const payload = saved.request().postDataJSON();
  expect(payload.expectedWorkflowVersion).toBeGreaterThan(0);
  if (!path.endsWith('/actions')) expect(payload.expectedVersion).toBeGreaterThan(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh Actions' })).toBeEnabled();
  return saved.json();
}

test('real UI creation/replay, reassignment, Admin lifecycle, correction and immutable history', async ({ page, browser, actors }) => {
  const parent = await ticket(actors.requester, { ownerId: actors.staff.id, currentStatus: 'IN_PROGRESS' });
  const path = actionPath(parent.id);
  await login(page, actors.staff); await openTicket(page, parent.id);
  await expect(page.getByText('No Actions Taken have been recorded for this Ticket.')).toBeVisible();
  await page.getByRole('button', { name: 'Create Action', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Description (required)').fill('Inspect the real connection');
  await dialog.getByLabel('Follow-up required', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Create Action', exact: true }).click();
  await expect(dialog.getByLabel('Follow-up note (required)')).toBeFocused();
  expect(await db.actionTaken.count({ where: { ticketId: parent.id } })).toBe(0);
  await dialog.getByLabel('Follow-up note (required)').fill('Verify stability tomorrow');
  await dialog.getByLabel('Attachment notes').fill('See the Ticket diagnostic report');

  let original: Record<string, unknown> | undefined;
  // The POST really commits; discard only its response to exercise uncertain-create recovery.
  await page.route(apiURL + '/api' + path, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    original = route.request().postDataJSON();
    const committed = await route.fetch(); expect(committed.status()).toBe(201);
    await route.abort('failed');
  }, { times: 1 });
  await dialog.getByRole('button', { name: 'Create Action', exact: true }).click();
  await expect(dialog.getByText(/creation result is uncertain/)).toBeVisible();
  await expect(dialog.getByLabel('Description (required)')).toBeDisabled();
  const replayRequest = page.waitForRequest(r => r.url() === apiURL + '/api' + path && r.method() === 'POST');
  let saved = await submit(page, 'Retry exact submission', path, 'POST');
  expect((await replayRequest).postDataJSON()).toEqual(original);
  expect(saved.replayed).toBe(true);
  expect(await db.actionTaken.count({ where: { ticketId: parent.id } })).toBe(1);
  expect(await db.actionTakenRevision.count({ where: { actionId: saved.action.id } })).toBe(1);
  const actionId = saved.action.id, item = path + '/' + actionId;
  await card(page, actionId).getByRole('button', { name: 'Edit Action' }).click();
  await page.getByRole('dialog').getByLabel('Assignee (required)').selectOption(String(actors.admin.id));
  await page.getByRole('dialog').getByLabel('Description (required)').fill('Admin performs the repair');
  saved = await submit(page, 'Save Action', item, 'PATCH');
  expect(saved.action.assignee.id).toBe(actors.admin.id);
  await expect(card(page, actionId).getByRole('button', { name: 'Start Action' })).toHaveCount(0);

  const adminContext = await browser.newContext({ baseURL: 'http://localhost:5174' });
  try {
    const adminPage = await adminContext.newPage(); await login(adminPage, actors.admin); await openTicket(adminPage, parent.id);
    await card(adminPage, actionId).getByRole('button', { name: 'Start Action' }).click();
    saved = await submit(adminPage, 'Start Action', item + '/transitions', 'POST');
    await card(adminPage, actionId).getByRole('button', { name: 'Complete Action' }).click();
    await adminPage.getByRole('dialog').getByRole('button', { name: 'Complete Action', exact: true }).click();
    await expect(adminPage.getByLabel('Result (required)')).toBeFocused();
    await adminPage.getByLabel('Result (required)').fill('Connection restored');
    saved = await submit(adminPage, 'Complete Action', item + '/transitions', 'POST');
    expect(saved.action).toMatchObject({ status: 'COMPLETED', createdBy: { id: actors.staff.id }, assignee: { id: actors.admin.id }, performedBy: { id: actors.admin.id }, followUpRequired: true });
    expect(saved.action.completedAt).not.toBeNull();
    await expect(card(adminPage, actionId).locator('dt').filter({ hasText: 'Performed by' }).locator('+ dd')).toHaveText(actors.admin.name);
    await card(adminPage, actionId).getByRole('button', { name: 'Correct Action' }).click();
    await adminPage.getByLabel('Follow-up required', { exact: true }).uncheck();
    await adminPage.getByRole('dialog').getByRole('button', { name: 'Save Action' }).click();
    await expect(adminPage.getByLabel('Change reason (required)')).toBeFocused();
    await adminPage.getByLabel('Change reason (required)').fill('Stability verified');
    const completedAt = saved.action.completedAt;
    saved = await submit(adminPage, 'Save Action', item, 'PATCH');
    expect(saved.action).toMatchObject({ followUpRequired: false, followUpNote: 'Verify stability tomorrow', completedAt, performedBy: { id: actors.admin.id } });
    await card(adminPage, actionId).getByRole('button', { name: 'View history' }).click();
    await expect(adminPage.getByRole('dialog').locator('summary')).toHaveCount(5);
    const history = await adminContext.request.get(apiURL + '/api' + item + '/history'); expect(history.status()).toBe(200);
    expect((await history.json()).data.map((r: { operation: string }) => r.operation)).toEqual(['CREATE', 'REASSIGN', 'START', 'COMPLETE', 'EDIT']);
  } finally { await adminContext.close(); }
});

test('real Requester own-Ticket read-only UI and cross-owner API/detail isolation', async ({ page, browser, actors }) => {
  const parent = await ticket(actors.requester), path = actionPath(parent.id);
  await login(page, actors.staff);
  const saved = await write(page.request, 'POST', path, { clientRequestId: randomUUID(), expectedWorkflowVersion: 1, description: 'Shared diagnostic result' }, 201);
  for (const own of [true, false]) {
    const context = await browser.newContext({ baseURL: 'http://localhost:5174' });
    try {
      const requesterPage = await context.newPage(); await login(requesterPage, own ? actors.requester : actors.other);
      await requesterPage.goto(`/#/tickets/${parent.id}`);
      const list = await context.request.get(apiURL + '/api' + path);
      if (own) {
        expect(list.status()).toBe(200);
        await expect(requesterPage.getByText('Shared diagnostic result', { exact: true })).toBeVisible();
        const region = requesterPage.getByRole('region', { name: 'Actions Taken' });
        await expect(region.getByRole('button', { name: /Create Action|Edit Action|Start Action|Cancel Action|View history/ })).toHaveCount(0);
        expect((await context.request.get(apiURL + '/api' + path + '/' + saved.action.id + '/history')).status()).toBe(403);
        expect((await mutation(context.request, 'PATCH', path + '/' + saved.action.id, { ...versions(saved), description: 'Forbidden edit' })).status()).toBe(403);
      } else {
        expect(list.status()).toBe(404);
        const missing = await context.request.get(apiURL + '/api/tickets/2147483647/actions');
        expect(missing.status()).toBe(404); expect(await missing.json()).toEqual(await list.json());
        await expect(requesterPage.getByRole('alert').first()).toContainText(/not found|unavailable/i);
        await expect(requesterPage.getByRole('region', { name: 'Actions Taken' })).toHaveCount(0);
        expect((await context.request.get(apiURL + '/api' + path + '/' + saved.action.id)).status()).toBe(404);
      }
    } finally { await context.close(); }
  }
});

test('real stale-version recovery, historical cycle restrictions and terminal/cancelled read-only UI', async ({ page, actors }) => {
  const parent = await ticket(actors.requester), path = actionPath(parent.id);
  await login(page, actors.staff);
  let saved = await write(page.request, 'POST', path, { clientRequestId: randomUUID(), expectedWorkflowVersion: 1, description: 'Original work' }, 201);
  const item = path + '/' + saved.action.id;
  await openTicket(page, parent.id);
  await card(page, saved.action.id).getByRole('button', { name: 'Edit Action' }).click();
  await page.getByLabel('Description (required)').fill('Retained browser draft');
  saved = await write(page.request, 'PATCH', item, { ...versions(saved), description: 'Concurrent real update' });
  const conflict = page.waitForResponse(r => new URL(r.url()).pathname === '/api' + item && r.request().method() === 'PATCH');
  await page.getByRole('dialog').getByRole('button', { name: 'Save Action' }).click();
  const rejected = await conflict; expect(rejected.status()).toBe(409); expect((await rejected.json()).code).toBe('TICKET_VERSION_CONFLICT');
  await expect(page.getByLabel('Description (required)')).toHaveValue('Retained browser draft');
  await page.getByRole('button', { name: 'Reload latest data' }).click();
  await expect(page.getByRole('dialog').getByText('Concurrent real update', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Action' })).toBeDisabled();
  await page.getByRole('button', { name: 'Use latest versions after review' }).click();
  saved = await submit(page, 'Save Action', item, 'PATCH');
  expect(saved.action.description).toBe('Retained browser draft'); expect(saved.action.version).toBe(3);
  saved = await write(page.request, 'POST', item + '/transitions', { ...versions(saved), targetStatus: 'IN_PROGRESS' });
  saved = await write(page.request, 'POST', item + '/transitions', { ...versions(saved), targetStatus: 'COMPLETED', result: 'Prior cycle repaired', followUpRequired: false });

  // Prepare subsequent-cycle/terminal fixtures directly, without integrating Issue #51 UI.
  const reopened = await db.ticket.update({ where: { id: parent.id }, data: { workCycle: 2, workflowVersion: { increment: 1 }, currentStatus: 'REOPENED' } });
  await page.getByRole('button', { name: 'Refresh Actions' }).click();
  await expect(page.getByRole('heading', { name: 'Work cycle 1 — Historical' })).toBeVisible();
  await expect(card(page, saved.action.id).getByRole('button', { name: 'Correct Action' })).toHaveCount(0);
  const historical = await mutation(page.request, 'PATCH', item, { expectedWorkflowVersion: reopened.workflowVersion, expectedVersion: saved.action.version, description: 'Forbidden historical edit', changeReason: 'Not allowed' });
  expect(historical.status()).toBe(409); expect((await historical.json()).code).toBe('TICKET_CYCLE_CONFLICT');
  await page.getByRole('button', { name: 'Create Action', exact: true }).click();
  await page.getByLabel('Description (required)').fill('Current cycle work');
  const current = await submit(page, 'Create Action', path, 'POST'); expect(current.action.cycle).toBe(2);
  await card(page, current.action.id).getByRole('button', { name: 'Cancel Action' }).click();
  await page.getByLabel('Cancellation reason (required)').fill('No longer required');
  await submit(page, 'Confirm cancellation', path + '/' + current.action.id + '/transitions', 'POST');
  await expect(card(page, current.action.id).getByText('Read-only cancelled Action.')).toBeVisible();
  const terminal = await db.ticket.update({ where: { id: parent.id }, data: { currentStatus: 'CANCELLED', workflowVersion: { increment: 1 } } });
  await page.getByRole('button', { name: 'Refresh Actions' }).click();
  await expect(page.getByText('This Ticket is terminal. Actions are read-only.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Action', exact: true })).toHaveCount(0);
  const blocked = await mutation(page.request, 'POST', path, { clientRequestId: randomUUID(), expectedWorkflowVersion: terminal.workflowVersion, description: 'Forbidden terminal work' });
  expect(blocked.status()).toBe(409); expect((await blocked.json()).code).toBe('TICKET_NOT_ACTIVE');
});
