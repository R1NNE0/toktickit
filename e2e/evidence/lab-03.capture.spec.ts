import { test, expect, login, navigate, ticket, db, apiURL } from '../lab-03/fixtures.js';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const destination = path.join(root, 'artifacts/lab-03/screenshots');
const captures: { file: string; [key: string]: unknown }[] = [];
const ownerOnly = process.env.LAB3_EVIDENCE_OWNER_ONLY === '1';
const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
];

test.afterAll(async () => {
  const head = (await readFile(path.join(root, '.git/HEAD'), 'utf8')).trim();
  const revision = head.startsWith('ref: ') ? (await readFile(path.join(root, '.git', head.slice(5)), 'utf8')).trim() : head;
  await mkdir(destination, { recursive: true });
  if (ownerOnly) {
    if (captures.length !== 6) throw new Error('Owner-only evidence requires all six detail/confirmation captures.');
    const previous = JSON.parse(await readFile(path.join(destination, 'manifest.json'), 'utf8'));
    const update = {
      capturedAt: new Date().toISOString(), revision,
      source: 'Working tree with Issue #36 OwnerRef fix; synthetic isolated database',
      command: "$env:LAB3_EVIDENCE_OWNER_ONLY='1'; npx.cmd playwright test --config playwright.evidence.config.ts",
      files: captures.map(capture => capture.file),
      applicationSha256: Object.fromEntries(await Promise.all(['server/src/attachments.ts', 'server/src/staffTicket.ts']
        .map(async file => [file, createHash('sha256').update(await readFile(path.join(root, file))).digest('hex')]))),
    };
    const replacements = new Map(captures.map(capture => [capture.file, { ...capture,
      capturedAt: update.capturedAt, revision, source: update.source }]));
    previous.captures = previous.captures.map((capture: { file: string }) => replacements.get(capture.file) ?? capture);
    previous.updates = [...(previous.updates ?? []), update];
    await writeFile(path.join(destination, 'manifest.json'), JSON.stringify(previous, null, 2) + '\n');
    return;
  }
  await writeFile(path.join(destination, 'manifest.json'), JSON.stringify({
    capturedAt: new Date().toISOString(), revision, branch: head.replace('ref: refs/heads/', ''),
    source: 'Unmodified integrated product; synthetic isolated database; browser-generated PNGs',
    command: 'npx.cmd playwright test --config playwright.evidence.config.ts', captures,
  }, null, 2) + '\n');
});

for (const viewport of viewports) {
  test(`EVID-02 capture major screens and feedback at ${viewport.name}`, async ({ page, actors }) => {
    await page.setViewportSize(viewport);
    // Display only purpose-made evidence identities. Passwords remain random and in memory.
    for (const [key, actor] of Object.entries(actors)) {
      const name = `Visual ${key === 'admin' ? 'Administrator' : key === 'staff' ? 'IT Staff' : key === 'initial' ? 'Initial User' : key === 'other' ? 'Other Requester' : 'Requester'}`;
      const email = `${key}.visual@example.com`;
      await db.user.update({ where: { id: actor.id }, data: { name, email, emailNormalized: email } });
      actor.name = name; actor.email = email;
    }
    async function capture(group: string, state: string, role: string, simulation: string | null = null) {
      if (ownerOnly && !(group === 'staff-ticket-detail' && ['detail', 'status-confirmation'].includes(state))) return;
      await page.evaluate(() => document.fonts.ready);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const dialog = page.getByRole('dialog');
      const modal = await dialog.count() > 0;
      if (modal) await dialog.evaluate(el => { el.scrollTop = 0; });
      else await page.evaluate(() => scrollTo(0, 0));
      async function save(suffix = '') {
        const relative = `${group}/${state}-${viewport.name}${suffix}.png`;
        const target = path.join(destination, relative);
        await mkdir(path.dirname(target), { recursive: true });
        const bytes = await page.screenshot({ path: target, fullPage: !modal, animations: 'disabled',
          mask: [page.locator('input[type="password"]')], maskColor: '#e5e7eb' });
        captures.push({ file: relative, role, state, viewport: { width: viewport.width, height: viewport.height },
          image: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
          sha256: createHash('sha256').update(bytes).digest('hex'), simulation,
          scope: modal ? suffix ? 'Dialog lower viewport; paired with main image' : 'Dialog viewport; see paired lower image if present'
            : suffix ? 'Full page with horizontally scrollable table at its right edge; paired with main image' : 'Full page' });
      }
      await save();
      if (modal && await dialog.evaluate(el => el.scrollHeight > el.clientHeight + 1)) {
        await dialog.evaluate(el => { el.scrollTop = el.scrollHeight; });
        await save('-bottom');
      }
      if (!modal) {
        const scrolled = await page.evaluate(() => {
          const elements = [...document.querySelectorAll<HTMLElement>('main *')].filter(el =>
            el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX));
          elements.forEach(el => { el.scrollLeft = el.scrollWidth; });
          return elements.length;
        });
        if (scrolled) {
          await save('-right');
          await page.evaluate(() => document.querySelectorAll<HTMLElement>('main *').forEach(el => { el.scrollLeft = 0; }));
        }
      }
    }
    const signOut = async () => {
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    };

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await capture('authentication', 'login', 'Signed out');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Enter a valid email');
    await capture('authentication', 'login-validation', 'Signed out');
    if (viewport.name === 'desktop') {
      await page.getByLabel('Email', { exact: true }).fill(actors.requester.email);
      await page.getByLabel('Password', { exact: true }).fill('Invalid synthetic credential');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Unable to sign in');
      await capture('authentication', 'login-failure', 'Signed out');
    }
    await login(page, actors.initial);
    await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();
    await capture('authentication', 'mandatory-change', 'Restricted Requester');
    await signOut();

    await login(page, actors.requester);
    await expect(page.getByText(/No tickets/i).first()).toBeVisible();
    await capture('requester-regression', 'my-tickets-empty', 'Requester');
    await navigate(page, 'Create Ticket');
    await expect(page.locator('#ticket-category option')).not.toHaveCount(1);
    await page.locator('#ticket-category').selectOption({ label: 'Hardware' });
    await page.locator('#ticket-related-system').selectOption({ label: 'Email' });
    await page.locator('#ticket-summary').fill('Laptop display flickers during presentations');
    await page.locator('#ticket-description').fill('The external display flickers when presenting in the teaching room. Please inspect the cable and display adapter.');
    await capture('requester-regression', 'create-ticket', 'Requester');
    await page.getByRole('button', { name: 'Create Ticket', exact: true }).last().click();
    await expect(page.getByText('Ticket Created Successfully!')).toBeVisible();
    await capture('requester-regression', 'create-success', 'Requester');
    const work = await db.ticket.findFirstOrThrow({ where: { requesterId: actors.requester.id } });
    await db.ticket.update({ where: { id: work.id }, data: { currentStatus: 'WAITING_FOR_REQUESTER', ownerId: actors.staff.id } });
    await db.publicComment.create({ data: { ticketId: work.id, authorId: actors.staff.id, body: 'The display adapter was replaced. Please confirm whether the flickering has stopped.' } });
    await db.internalNote.create({ data: { ticketId: work.id, authorId: actors.staff.id, body: 'Synthetic internal example: keep adapter troubleshooting details within the IT team.' } });
    await page.getByRole('button', { name: 'View Ticket Detail' }).click();
    await expect(page.getByText('The display adapter was replaced.', { exact: false })).toBeVisible();
    await page.getByLabel('Add Attachment').setInputFiles({ name: 'display-adapter-inspection.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic evidence') });
    await expect(page.getByRole('button', { name: 'Download display-adapter-inspection.pdf' })).toBeVisible();
    await capture('requester-regression', 'ticket-detail', 'Requester');
    await page.getByRole('button', { name: 'Problem Appears Resolved', exact: true }).click();
    await capture('requester-regression', 'resolution-confirmation', 'Requester');
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Resolution Indicated' })).toBeDisabled();
    await capture('requester-regression', 'resolution-indicated', 'Requester');
    await navigate(page, 'My Tickets');
    await expect(page.getByText(work.ticketNumber).filter({ visible: true }).first()).toBeVisible();
    await capture('requester-regression', 'my-tickets', 'Requester');
    await signOut();

    for (const [index, status] of ['NEW', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'].entries())
      await ticket(actors.requester, { ticketNumber: `VIS-${viewport.name}-${index + 1}`, summary: ['Campus Wi-Fi disconnects', 'Printer paper feed issue', 'VPN connection review', 'Email delivery restored', 'Software setup complete', 'Access issue returned', 'Duplicate request cancelled'][index], currentStatus: status, ownerId: index % 2 ? actors.staff.id : null });
    await login(page, actors.staff);
    await expect(page.getByRole('heading', { name: 'IT Staff Ticket Queue' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Open Detail/ }).first()).toBeVisible();
    if (viewport.name === 'mobile') await page.getByRole('button', { name: 'Filters and sorting' }).click();
    await capture('staff-queue', 'queue', 'IT Staff');
    await page.getByLabel('Search tickets').fill('No matching synthetic request');
    await expect(page.getByText('No matching tickets. Try changing or clearing the filters.')).toBeVisible();
    await capture('staff-queue', 'no-results', 'IT Staff');
    await page.getByRole('button', { name: 'Clear Filters' }).click();
    await expect(page.getByRole('button', { name: /^Open Detail/ }).first()).toBeVisible();
    if (viewport.name === 'desktop') {
      let release!: () => void;
      let intercepted!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const requestStarted = new Promise<void>(resolve => { intercepted = resolve; });
      const queueURL = /\/api\/staff\/tickets(?:\?|$)/;
      await page.route(queueURL, async route => { intercepted(); await gate; await route.continue(); }, { times: 1 });
      await page.getByRole('button', { name: 'Refresh Queue' }).click();
      await requestStarted;
      await expect(page.getByText('Loading Ticket Queue...')).toBeVisible();
      await capture('staff-queue', 'loading', 'IT Staff', 'Request deliberately held, then released');
      release(); await page.unrouteAll({ behavior: 'wait' });
      await expect(page.getByRole('button', { name: /^Open Detail/ }).first()).toBeVisible();
      await page.route(queueURL, route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL_ERROR', error: 'Unable to complete the request.' }) }), { times: 1 });
      await page.getByRole('button', { name: 'Refresh Queue' }).click();
      await expect(page.getByRole('alert')).toBeVisible();
      await capture('staff-queue', 'safe-failure', 'IT Staff', 'Injected safe HTTP 500, no successful data fabricated');
      await page.unrouteAll();
    }
    await page.goto('/#/tickets/' + work.id);
    await expect(page.getByLabel('Next Status')).toBeVisible();
    await expect(page.getByText('Synthetic internal example:', { exact: false })).toBeVisible();
    await expect(page.getByText('Current Owner:', { exact: true }).locator('..'))
      .toHaveText('Current Owner: Visual IT Staff (IT Staff)');
    await capture('staff-ticket-detail', 'detail', 'IT Staff');
    await page.getByLabel('Next Status').selectOption('RESOLVED');
    await page.getByRole('button', { name: 'Update Status', exact: true }).click();
    await capture('staff-ticket-detail', 'status-confirmation', 'IT Staff');
    await page.keyboard.press('Escape');
    await signOut();

    await login(page, actors.admin);
    await page.getByLabel('Search users').fill('Visual');
    await expect(page.getByText('Visual Requester', { exact: true })).toBeVisible();
    await capture('user-management', 'directory', 'Administrator');
    await page.getByRole('button', { name: /Create User/ }).click();
    await capture('user-management', 'create-user', 'Administrator');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Edit user Visual Requester', exact: true }).click();
    await capture('user-management', 'edit-user', 'Administrator');
    await page.getByRole('dialog').getByRole('button', { name: 'Set New Initial Password' }).click();
    await capture('user-management', 'initial-password-reset', 'Administrator');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Edit user Visual Administrator', exact: true }).click();
    await expect(page.getByLabel('Active Account')).toBeDisabled();
    await capture('user-management', 'self-deactivation-protected', 'Administrator');
    await page.keyboard.press('Escape');
    await page.goto('/#/tickets/' + work.id);
    await expect(page.getByLabel('IT Priority', { exact: true })).toBeVisible();
    await expect(page.getByText('Synthetic internal example:', { exact: false })).toBeVisible();
    await capture('staff-ticket-detail', 'administrator-permitted-detail', 'Administrator');
    expect((await page.request.get(apiURL + '/api/staff/tickets')).status()).toBe(403);
    await signOut();
  });
}
