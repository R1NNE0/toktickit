import { test, expect, login, navigate, ticket, db, apiURL, mutation, noOverflow } from '../lab-03/fixtures.js';
import type { Page } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const destination = path.join(root, 'artifacts/lab-04/screenshots');
const captures: Record<string, unknown>[] = [], scenarios: Record<string, unknown>[] = [], checks: Record<string, unknown>[] = [];
const append = process.env.LAB4_EVIDENCE_APPEND === '1';
test.afterEach(async ({}, info) => { scenarios.push({ title: info.title, status: info.status }); });
test.afterAll(async () => {
  let revision = 'unavailable', branch = 'unavailable';
  try {
    const head = (await readFile(path.join(root, '.git/HEAD'), 'utf8')).trim();
    if (head.startsWith('ref: ')) {
      const ref = head.slice(5); branch = ref.replace('refs/heads/', '');
      try { revision = (await readFile(path.join(root, '.git', ref), 'utf8')).trim(); }
      catch { revision = (await readFile(path.join(root, '.git/packed-refs'), 'utf8')).split('\n').find(line => line.endsWith(' ' + ref))?.split(' ')[0] ?? 'unavailable'; }
    } else revision = head;
  } catch { /* Keep missing provenance explicit; never invent a commit. */ }
  const files = ['client/src/App.tsx', 'client/src/index.css', 'client/src/components/ActionsTaken.tsx', 'client/src/components/ActionDialog.tsx',
    'client/src/components/StaffDashboard.tsx', 'client/src/components/RequesterDashboard.tsx', 'server/src/staffDashboard.ts', 'server/src/requesterDashboard.ts'];
  const sourceSha256 = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')])));
  await mkdir(destination, { recursive: true });
  const previous = append ? JSON.parse(await readFile(path.join(destination, 'manifest.json'), 'utf8')) : null;
  const command = append ? "$env:LAB4_EVIDENCE_APPEND='1'; npx.cmd playwright test --config playwright.lab4-evidence.config.ts -g 'Staff assigned work'"
    : 'npx.cmd playwright test --config playwright.lab4-evidence.config.ts';
  if (previous && JSON.stringify(previous.sourceSha256) !== JSON.stringify(sourceSha256)) throw new Error('Product changed since initial captures; do not combine provenance silently.');
  const combinedCaptures = new Map<string, Record<string, unknown>>((previous?.captures ?? []).map((c: any) => [c.file, c]));
  for (const c of captures) combinedCaptures.set(c.file as string, c);
  await writeFile(path.join(destination, 'manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), timezone: 'Asia/Bangkok', revision, branch,
    provenance: 'HEAD/ref metadata read directly; no Git command executed. Dirty state not inspected; hashes identify captured product files. This is workspace evidence, not final-main verification.',
    command,
    source: 'Actual Chromium renders of existing application; synthetic isolated PostgreSQL fixtures; explicitly labelled response injections only for feedback captures.',
    sourceSha256, scenarios: [...(previous?.scenarios ?? []), ...scenarios], captures: [...combinedCaptures.values()], checks: [...(previous?.checks ?? []), ...checks],
    runs: [...(previous?.runs ?? (previous ? [{ command: previous.command, capturedAt: previous.capturedAt, scenarios: previous.scenarios }] : [])), { command, capturedAt: new Date().toISOString(), scenarios }],
    humanSignOff: 'Pending student/peer review' }, null, 2) + '\n');
  await db.$disconnect();
});

for (const viewport of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'mobile', width: 375, height: 812 }]) {
  test(`Lab 4 release captures at ${viewport.name}`, async ({ page, browser, actors }) => {
    await page.setViewportSize(viewport);
    for (const role of ['requester','other','staff','admin'] as const) {
      actors[role].name = `Evidence ${role === 'admin' ? 'Administrator' : role === 'staff' ? 'IT Staff' : role === 'other' ? 'Empty Requester' : 'Requester'}`;
      await db.user.update({ where: { id: actors[role].id }, data: { name: actors[role].name } });
    }
    await db.user.update({ where: { id: actors.initial.id }, data: { role: 'IT_STAFF', isActive: false } });
    const parent = await ticket(actors.requester, { summary: 'Restore meeting-room network access', currentStatus: 'IN_PROGRESS', ownerId: actors.staff.id });
    const foreign = await ticket(actors.other, { summary: 'Other Requester private Ticket' });
    const card = (p: Page, id: number) => p.locator(`[aria-labelledby="action-title-${id}"]`);
    async function capture(p: Page, group: string, state: string, role: string, simulation: string | null = null) {
      await p.evaluate(() => document.fonts.ready); await noOverflow(p);
      const modal = p.getByRole('dialog'); const isModal = await modal.count() > 0;
      if (isModal) await modal.evaluate(el => { el.scrollTop = 0; }); else await p.evaluate(() => scrollTo(0,0));
      async function save(suffix = '') {
        const file = `${group}/${state}-${viewport.name}${suffix}.png`, target = path.join(destination, file);
        await mkdir(path.dirname(target), { recursive: true });
        const bytes = await p.screenshot({ path: target, fullPage: !isModal, animations: 'disabled', mask: [p.locator('input[type="password"]')] });
        captures.push({ file, role, state, capturedAt: new Date().toISOString(), viewport, simulation,
          image: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }, sha256: createHash('sha256').update(bytes).digest('hex'),
          scope: isModal ? 'Dialog viewport; -bottom file accompanies scrollable dialogs' : 'Full page' });
      }
      await save();
      if (isModal && await modal.evaluate(el => el.scrollHeight > el.clientHeight + 1)) { await modal.evaluate(el => { el.scrollTop = el.scrollHeight; }); await save('-bottom'); }
    }
    async function open(p: Page) { await p.goto('/#/tickets/' + parent.id); await expect(p.getByRole('button', { name: 'Refresh Actions', exact: true })).toBeEnabled(); }
    async function submit(p: Page, label: string, suffix: string, method = 'POST') {
      const pending = p.waitForResponse(r => new URL(r.url()).pathname.endsWith(suffix) && r.request().method() === method);
      await p.getByRole('dialog').getByRole('button', { name: label, exact: true }).click();
      const response = await pending; expect(response.status(), await response.text()).toBeLessThan(300);
      await expect(p.getByRole('dialog')).toHaveCount(0);
      await expect(p.getByRole('button', { name: 'Refresh Actions', exact: true })).toBeEnabled(); return response.json();
    }
    async function create(data: object) {
      const detail = await page.request.get(apiURL + `/api/staff/tickets/${parent.id}`); expect(detail.status()).toBe(200);
      const t = await detail.json();
      const response = await mutation(page.request, 'POST', `/tickets/${parent.id}/actions`, { clientRequestId: randomUUID(), expectedWorkflowVersion: t.workflowVersion, ...data });
      expect(response.status(), await response.text()).toBe(201); return response.json();
    }
    await login(page, actors.staff);
    await expect(page.getByRole('button', { name: /^My active Tickets / })).toBeVisible();
    const metrics = await (await page.request.get(apiURL + '/api/dashboard/staff')).json();
    const active = ['NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED'] as const;
    const expected = await db.ticket.count({ where: { ownerId: actors.staff.id, currentStatus: { in: [...active] } } });
    expect(metrics.metrics.myActiveTickets).toBe(expected);
    checks.push({ viewport: viewport.name, kind: 'Staff metric/database equality', actual: metrics.metrics.myActiveTickets, expected, predicate: 'ownerId=session.id AND status in ACTIVE' });
    await capture(page, 'staff-dashboard', 'operational', 'IT_STAFF');
    await open(page);
    await capture(page, 'workflow', 'resolution-blocked-no-actions', 'IT_STAFF');
    await page.getByRole('button', { name: 'Create Action', exact: true }).click();
    await page.getByLabel('Description (required)').fill('Inspect the network switch and replace the faulty cable');
    await page.getByLabel('Follow-up required', { exact: true }).check();
    await page.getByRole('dialog').getByRole('button', { name: 'Create Action', exact: true }).click();
    await expect(page.getByLabel('Follow-up note (required)')).toBeFocused();
    await capture(page, 'actions-taken', 'create-follow-up-validation', 'IT_STAFF');
    await page.getByLabel('Follow-up note (required)').fill('Confirm connectivity after the meeting');
    await page.getByLabel('Attachment notes').fill('Look for network-diagnostics.pdf in the Ticket attachments');
    let first = await submit(page, 'Create Action', '/actions');
    await card(page, first.action.id).getByRole('button', { name: 'Edit Action', exact: true }).click();
    if (viewport.name === 'desktop') await capture(page, 'actions-taken', 'edit-assignment', 'IT_STAFF');
    await page.getByLabel('Description (required)').fill('Inspect switch ports, replace cable, and verify stable connectivity');
    first = await submit(page, 'Save Action', '/actions/' + first.action.id, 'PATCH');
    await card(page, first.action.id).getByRole('button', { name: 'Start Action', exact: true }).click();
    first = await submit(page, 'Start Action', '/transitions');
    await card(page, first.action.id).getByRole('button', { name: 'Complete Action', exact: true }).click();
    await page.getByLabel('Result (required)').fill('Connectivity restored; awaiting Requester confirmation');
    await capture(page, 'actions-taken', 'complete-attribution', 'IT_STAFF');
    first = await submit(page, 'Complete Action', '/transitions');
    const second = await create({ description: 'Administrator verifies the switch configuration', assigneeId: actors.admin.id });
    let third = await create({ description: 'Replace the entire switch if required' });
    const cancelled = await mutation(page.request, 'POST', `/tickets/${parent.id}/actions/${third.action.id}/transitions`, {
      expectedWorkflowVersion: third.ticket.workflowVersion, expectedVersion: third.action.version, targetStatus: 'CANCELLED', confirmed: true, reason: 'Cable replacement made this unnecessary' });
    expect(cancelled.status()).toBe(200);
    const latest = await (await page.request.get(apiURL + `/api/staff/tickets/${parent.id}`)).json();
    const bad = await mutation(page.request, 'POST', `/tickets/${parent.id}/actions`, { clientRequestId: randomUUID(), expectedWorkflowVersion: latest.workflowVersion,
      description: 'Rejected inactive assignee demonstration', assigneeId: actors.initial.id });
    expect(bad.status()).toBe(400); expect((await bad.json()).code).toBe('INELIGIBLE_ASSIGNEE');
    checks.push({ viewport: viewport.name, kind: 'Inactive Staff assignment rejected', status: bad.status(), code: 'INELIGIBLE_ASSIGNEE' });
    const adminContext = await browser.newContext({ baseURL: 'http://localhost:5174', viewport: { width: viewport.width, height: viewport.height } });
    try {
      const admin = await adminContext.newPage(); await login(admin, actors.admin);
      await expect(admin.getByRole('button', { name: /^My outstanding Actions 1$/ })).toBeVisible();
      await capture(admin, 'staff-dashboard', 'administrator-operational', 'ADMINISTRATOR');
      await open(admin); await expect(admin.getByRole('button', { name: 'Claim Ticket', exact: true })).toHaveCount(0);
      await card(admin, second.action.id).getByRole('button', { name: 'Start Action', exact: true }).click(); await submit(admin, 'Start Action', '/transitions');
      await card(admin, second.action.id).getByRole('button', { name: 'Complete Action', exact: true }).click();
      await admin.getByLabel('Result (required)').fill('Configuration verified by the assigned Administrator');
      await admin.getByLabel('Follow-up required', { exact: true }).uncheck(); await submit(admin, 'Complete Action', '/transitions');
      if (viewport.name === 'desktop') await capture(admin, 'actions-taken', 'administrator-capability-boundary', 'ADMINISTRATOR');
    } finally { await adminContext.close(); }
    await page.getByRole('button', { name: 'Refresh Actions', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Refresh Actions', exact: true })).toBeEnabled();
    await expect(card(page, second.action.id).getByRole('button', { name: 'Correct Action', exact: true })).toBeVisible();
    await expect(card(page, first.action.id).getByRole('button', { name: 'Correct Action', exact: true })).toBeVisible();
    await capture(page, 'workflow', 'follow-up-resolution-gate', 'IT_STAFF');
    await capture(page, 'actions-taken', 'multiple-actions-and-identities', 'IT_STAFF');
    await card(page, first.action.id).getByRole('button', { name: 'Correct Action', exact: true }).click();
    await page.getByLabel('Follow-up required', { exact: true }).uncheck();
    await page.getByLabel('Change reason (required)').fill('Requester confirmed stable connectivity; follow-up complete');
    await submit(page, 'Save Action', '/actions/' + first.action.id, 'PATCH');
    await card(page, first.action.id).getByRole('button', { name: 'View history', exact: true }).click();
    await expect(page.getByRole('dialog').getByText(/Version 1 /)).toBeVisible();
    await page.getByRole('dialog').locator('details').first().evaluate(el => { (el as HTMLDetailsElement).open = true; });
    await capture(page, 'actions-taken', 'append-only-history', 'IT_STAFF'); await page.keyboard.press('Escape');
    await page.getByLabel('Next Status').selectOption('RESOLVED'); await page.getByRole('button', { name: 'Update Status', exact: true }).click();
    await capture(page, 'workflow', 'resolution-confirmation', 'IT_STAFF'); await submit(page, 'Confirm Status Change', '/status', 'PATCH');
    if (viewport.name === 'desktop') await capture(page, 'workflow', 'resolved-terminal-read-only', 'IT_STAFF');
    await page.getByLabel('Next Status').selectOption('REOPENED'); await page.getByRole('button', { name: 'Update Status', exact: true }).click();
    await page.getByLabel('Transition reason').fill('Requester reported intermittent connectivity after another meeting'); await submit(page, 'Confirm Status Change', '/status', 'PATCH');
    await capture(page, 'workflow', 'reopened-historical-cycle', 'IT_STAFF');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await login(page, actors.requester); await expect(page.getByRole('button', { name: /^Active tickets 1$/ })).toBeVisible();
    const requesterMetrics = await (await page.request.get(apiURL + '/api/dashboard/requester')).json();
    const own = await db.ticket.count({ where: { requesterId: actors.requester.id, currentStatus: { in: [...active] } } });
    expect(requesterMetrics.metrics.activeTickets).toBe(own);
    checks.push({ viewport: viewport.name, kind: 'Requester metric/database equality', actual: requesterMetrics.metrics.activeTickets, expected: own, predicate: 'requesterId=session.id AND status in ACTIVE' });
    await capture(page, 'requester-dashboard', 'owned-activity', 'REQUESTER');
    await page.getByRole('button', { name: /^Active tickets 1$/ }).click(); await expect(page.getByLabel('Active Ticket filters')).toContainText('active');
    if (viewport.name === 'desktop') await capture(page, 'requester-dashboard', 'active-drill-down', 'REQUESTER');
    await open(page); await expect(page.getByRole('button', { name: /Create Action|View history|Correct Action/ })).toHaveCount(0);
    await capture(page, 'actions-taken', 'requester-read-only', 'REQUESTER');
    const forbidden = await page.request.get(apiURL + '/api/dashboard/staff'); expect(forbidden.status()).toBe(403);
    checks.push({ viewport: viewport.name, kind: 'Requester operational dashboard denied', status: forbidden.status() });
    if (viewport.name === 'desktop') {
      await page.goto('/#/tickets/' + foreign.id); await expect(page.getByRole('alert')).toBeVisible();
      await capture(page, 'requester-dashboard', 'foreign-ticket-safe-error', 'REQUESTER');
      await db.ticket.delete({ where: { id: foreign.id } });
      await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await login(page, actors.other);
      await expect(page.getByRole('button', { name: 'Active tickets 0', exact: true })).toBeVisible();
      await capture(page, 'requester-dashboard', 'genuine-empty', 'REQUESTER');
      await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await login(page, actors.staff);
      await expect(page.getByRole('button', { name: /^My active Tickets / })).toBeVisible();
      await page.route(apiURL + '/api/dashboard/staff', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'EVIDENCE_FAILURE', error: 'Explicit evidence-only simulated outage' }) }), { times: 1 });
      await page.getByRole('button', { name: 'Refresh Dashboard', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Counts are unavailable');
      await capture(page, 'staff-dashboard', 'safe-failure-injected', 'IT_STAFF', 'One dashboard GET replaced with labelled HTTP 503; browser renders existing error UI. Not a real backend outage.');
    }
  });
}

for (const viewport of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'mobile', width: 375, height: 812 }]) {
  test(`Staff assigned work at ${viewport.name}`, async ({ page, actors }) => {
    await page.setViewportSize(viewport);
    await db.user.update({ where: { id: actors.staff.id }, data: { name: 'Evidence IT Staff' } });
    const parent = await ticket(actors.requester, { summary: 'Verify conference-room connectivity', ownerId: actors.staff.id, currentStatus: 'IN_PROGRESS' });
    await login(page, actors.staff);
    const created = await mutation(page.request, 'POST', `/tickets/${parent.id}/actions`, { clientRequestId: randomUUID(),
      expectedWorkflowVersion: parent.workflowVersion, description: 'Inspect switch ports and verify the replacement cable', assigneeId: actors.staff.id });
    expect(created.status()).toBe(201);
    await page.getByRole('button', { name: 'Refresh Dashboard', exact: true }).click();
    await expect(page.getByRole('button', { name: 'My outstanding Actions 1', exact: true })).toBeVisible();
    const response = await page.request.get(apiURL + '/api/dashboard/staff'); expect(response.status()).toBe(200);
    const body = await response.json();
    const expected = await db.actionTaken.count({ where: { assigneeId: actors.staff.id, status: { in: ['PLANNED','IN_PROGRESS'] }, cycle: parent.workCycle,
      ticket: { id: parent.id, workCycle: parent.workCycle, currentStatus: { in: ['NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED'] } } } });
    expect(body.metrics.myOutstandingActions).toBe(expected); expect(expected).toBe(1); expect(body.myActions.total).toBe(1);
    checks.push({ viewport: viewport.name, kind: 'Staff assigned Actions/database equality', actual: body.metrics.myOutstandingActions, expected,
      predicate: 'assigneeId=session.id AND unfinished AND active parent AND current cycle' });
    await noOverflow(page); await page.evaluate(() => document.fonts.ready);
    const file = `staff-dashboard/assigned-work-${viewport.name}.png`, target = path.join(destination,file);
    await mkdir(path.dirname(target), { recursive: true });
    const bytes = await page.screenshot({ path: target, fullPage: true, animations: 'disabled', mask: [page.locator('input[type="password"]')] });
    captures.push({ file, role: 'IT_STAFF', state: 'assigned-work', capturedAt: new Date().toISOString(), viewport, simulation: null,
      image: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }, sha256: createHash('sha256').update(bytes).digest('hex'), scope: 'Full page' });
  });
}
