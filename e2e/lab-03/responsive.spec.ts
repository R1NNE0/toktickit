import { test, expect, login, ticket, navigate, noOverflow, db } from './fixtures.js';
import { randomUUID } from 'node:crypto';
for (const viewport of [{ width: 1280, height: 800 }, { width: 768, height: 1024 }, { width: 375, height: 812 }]) {
  test(`RESP-01/02 role screens, keyboard dialogs and long content at ${viewport.width}`, async ({ page, actors }) => {
    await page.setViewportSize(viewport);
    const work = await ticket(actors.requester, { summary: 'Long'.repeat(45), description: 'Details'.repeat(100), currentStatus: 'WAITING_FOR_REQUESTER', ownerId: actors.staff.id });
    await db.user.update({ where: { id: actors.other.id }, data: { email: 'long'.repeat(45) + '@example.com', emailNormalized: 'long'.repeat(45) + '@example.com' } });
    await page.goto('/'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
    await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await login(page, actors.initial); await noOverflow(page);
    await page.getByLabel('Current password', { exact: true }).fill(actors.initial.password);
    const changed = 'Changed ' + randomUUID(); await page.getByLabel('New password', { exact: true }).fill(changed);
    await page.getByLabel('Confirm new password').fill(changed); await page.getByRole('button', { name: 'Save password' }).click();
    await expect(page.getByRole('heading', { name: 'Change password' })).toHaveCount(0);
    await navigate(page, 'Create Ticket'); await expect(page.locator('#ticket-summary')).toBeVisible(); await noOverflow(page);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await login(page, actors.requester); await noOverflow(page); await page.goto('/#/tickets/' + work.id);
    await expect(page.getByRole('button', { name: 'Problem Appears Resolved', exact: true })).toBeVisible(); await noOverflow(page);
    const trigger = page.getByRole('button', { name: 'Problem Appears Resolved', exact: true });
    await trigger.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveAccessibleName(/Confirm Problem Appears Resolved/);
    await expect.poll(() => page.getByRole('dialog').evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Shift+Tab'); await expect.poll(() => page.getByRole('dialog').evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(trigger).toBeFocused();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await login(page, actors.staff); await expect(page.getByRole('heading', { name: 'IT Staff Ticket Queue' })).toBeVisible(); await noOverflow(page);
    await page.goto('/#/tickets/' + work.id); await expect(page.getByLabel('Next Status')).toBeVisible(); await noOverflow(page);
    await page.getByLabel('Next Status').selectOption('RESOLVED'); await page.getByRole('button', { name: 'Update Status', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveAccessibleName(/Confirm Status Change/); await noOverflow(page);
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
    const filename = 'long'.repeat(35) + '.pdf';
    await page.getByLabel('Add Attachment').setInputFiles({ name: filename, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 responsive') });
    await expect(page.getByText(filename, { exact: true })).toBeVisible(); await noOverflow(page);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await login(page, actors.admin); await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible(); await noOverflow(page);
    if (viewport.width < 768) await expect(page.getByRole('table', { name: 'Users Directory' }).locator('tbody tr').first()).toHaveCSS('display', 'block');
    const create = page.getByRole('button', { name: /Create User/ }); await create.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveAccessibleName('Create New User');
    await expect.poll(() => page.getByRole('dialog').evaluate(el => el.contains(document.activeElement))).toBe(true);
    await noOverflow(page); await page.keyboard.press('Escape'); await expect(create).toBeFocused();
    await page.goto('/#/tickets/' + work.id);
    await expect(page.getByLabel('IT Priority', { exact: true })).toBeVisible();
    await expect(page.getByText(filename, { exact: true })).toBeVisible(); await noOverflow(page);
    await expect(page.getByRole('button', { name: /Download|Remove|Claim Ticket/ })).toHaveCount(0);
  });
}
test('RESP-01 queue breakpoint boundaries keep status badges inside their cells', async ({ page, actors }) => {
  const work = await ticket(actors.requester, { currentStatus: 'WAITING_FOR_REQUESTER' }); await login(page, actors.staff);
  await page.getByLabel('Search tickets').fill(work.ticketNumber);
  await expect(page.getByText('1 matching tickets')).toBeVisible();
  for (const width of [767, 768, 991, 992]) {
    await page.setViewportSize({ width, height: 900 }); await noOverflow(page);
    if (width >= 992) expect(await page.locator('.queue-table .badge-status').evaluate(el => {
      const badge = el.getBoundingClientRect(), cell = el.closest('td')!.getBoundingClientRect(); return badge.left >= cell.left && badge.right <= cell.right;
    })).toBe(true);
  }
});
