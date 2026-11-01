import { test, expect, login, navigate, noOverflow, ticket } from '../lab-03/fixtures.js';

for (const viewport of [{ width: 1280, height: 800 }, { width: 768, height: 1024 }, { width: 375, height: 812 }]) {
  test(`L4-RESP-01/02 dashboard keyboard drill-down and actual contrast at ${viewport.width}`, async ({ page, actors }) => {
    await page.setViewportSize(viewport);
    await ticket(actors.requester, { summary: 'Long dashboard summary '.repeat(40) });
    for (const role of ['requester', 'staff', 'admin'] as const) {
      await login(page, actors[role]);
      const card = page.getByRole('button', { name: role === 'requester' ? /^Active tickets \d+$/ : /^Unassigned active Tickets \d+$/ });
      await expect(card).toBeVisible(); await noOverflow(page);
      // Compute the rendered colors, including transparent backgrounds, rather
      // than assuming named design tokens guarantee readable combinations.
      const ratio = await card.evaluate(element => {
        const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number);
        const blend = (front: number[], back: number[]) => front.slice(0,3).map((n,i) => n * (front[3] ?? 1) + back[i] * (1 - (front[3] ?? 1)));
        const background = (node: Element | null): number[] => node
          ? blend(rgb(getComputedStyle(node).backgroundColor), background(node.parentElement)) : [255,255,255];
        const luminance = (color: number[]) => color.slice(0,3).map(n => n / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
          .reduce((sum,n,i) => sum + n * [0.2126,0.7152,0.0722][i], 0);
        const bg = background(element), fg = blend(rgb(getComputedStyle(element).color), bg);
        const a = luminance(fg), b = luminance(bg); return (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05);
      });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      const size = await card.boundingBox(); expect(size!.height).toBeGreaterThanOrEqual(44); expect(size!.width).toBeGreaterThanOrEqual(44);
      await card.focus(); await expect(card).toBeFocused(); await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: role === 'requester' ? 'My Support Tickets' : role === 'staff' ? 'IT Staff Ticket Queue' : 'Administrator Ticket Queue', exact: true })).toBeVisible();
      await navigate(page, 'Dashboard'); await expect(card).toBeVisible();
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    }
  });
}
