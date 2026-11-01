import { test, expect, type Page } from "@playwright/test";
import { staff, admin, requester, ticket, action, page as pageResult } from "../../client/tests/lab-04/fixtures.js";

async function mockApi(page: Page, role: "IT_STAFF" | "ADMINISTRATOR" | "REQUESTER") {
  const user = role === "IT_STAFF" ? staff : role === "ADMINISTRATOR" ? admin : requester;
  let parent = { ...ticket, ownerId: staff.id, owner: staff, requester, category: { id: 1, name: "Network" }, relatedSystem: { id: 1, name: "Wi-Fi" },
    resolutionSuggestedAt: null, resolutionSuggestedById: null, attachmentCount: 0 };
  let actions = [{ ...action, description: "Long diagnostic detail " + "x".repeat(300), assignee: user.role === "REQUESTER" ? staff : user }];
  const calls: { path: string; method: string; body: any }[] = [];
  await page.route("http://localhost:3102/api/**", async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
    const body = method === "GET" ? undefined : req.postDataJSON(); calls.push({ path, method, body });
    const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path === "/api/auth/csrf") return json({ csrfToken: "synthetic-browser-token" });
    if (path === "/api/auth/me") return json({ user });
    if (path === "/api/staff/assignees") return json([staff, admin]);
    if (path === "/api/tickets/101" || path === "/api/staff/tickets/101") return json(parent);
    if (path === "/api/staff/tickets" || path === "/api/tickets") return json(pageResult([parent]));
    if (path.endsWith("/comments") || path.endsWith("/notes")) return json(pageResult([]));
    if (path === "/api/tickets/101/actions" && method === "GET") return json(pageResult(actions));
    if (path === "/api/tickets/101/actions" && method === "POST") {
      expect(body.expectedWorkflowVersion).toBe(parent.workflowVersion);
      expect(body.clientRequestId).toMatch(/^[a-f0-9-]{36}$/);
      const created = { ...action, id: 6, version: 1, description: body.description, assignee: user, createdBy: user };
      actions = [...actions, created]; parent = { ...parent, workflowVersion: parent.workflowVersion + 1 };
      return json({ action: created, ticket: { id: 101, workflowVersion: parent.workflowVersion, workCycle: 1, updatedAt: parent.updatedAt }, replayed: false }, 201);
    }
    if (path.endsWith("/history")) {
      const { assignee, createdBy, performedBy, ...snapshot } = actions[0];
      return json(pageResult([{ id: 1, actionId: 5, version: 1, operation: "CREATE", actor: admin, occurredAt: ticket.createdAt, changeReason: null,
        snapshot: { ...snapshot, version: 1, assigneeId: assignee.id, createdById: createdBy.id, performedById: null } }]));
    }
    return json({ code: "NOT_FOUND", error: "Synthetic route not provided" }, 404);
  });
  await page.goto("/#/tickets/101");
  await expect(page.getByRole("region", { name: "Actions Taken" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Action #5", exact: true })).toBeVisible();
  return calls;
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 768, height: 1024 }, { width: 375, height: 812 }]) {
  test(`Actions layout and keyboard form at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport); await mockApi(page, "IT_STAFF");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Create Action", exact: true }).click();
    const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab"); await expect(dialog.getByRole("button", { name: "Discard / close" })).toBeFocused();
    await page.keyboard.press("Tab"); await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
    await dialog.getByRole("button", { name: "Create Action", exact: true }).click();
    await expect(dialog.getByLabel("Description (required)")).toBeFocused();
    await dialog.getByLabel("Description (required)").fill("Browser verified work");
    await dialog.getByLabel("Follow-up required", { exact: true }).check();
    await dialog.getByRole("button", { name: "Create Action", exact: true }).click();
    await expect(dialog.getByLabel("Follow-up note (required)")).toBeFocused();
    await dialog.getByLabel("Follow-up note (required)").fill("Confirm tomorrow");
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await dialog.getByRole("button", { name: "Create Action", exact: true }).click();
    await expect(dialog).toHaveCount(0); await expect(page.getByText("Action #6 saved.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Action #6", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Actions Taken", exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
test("Administrator uses the existing general detail for Actions without Staff-only Ticket controls", async ({ page }) => {
  await mockApi(page, "ADMINISTRATOR");
  await expect(page.getByRole("button", { name: "Claim Ticket" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Post Comment" })).toHaveCount(0);
  await page.getByRole("button", { name: "Create Action", exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel("Assignee (required)")).toHaveValue("3");
});
test("Requester sees shared work and no privileged operations or history requests", async ({ page }) => {
  const calls = await mockApi(page, "REQUESTER");
  const actions = page.getByRole("region", { name: "Actions Taken" });
  await expect(actions.getByRole("button", { name: /Create Action|Edit Action|View history|Start Action/ })).toHaveCount(0);
  expect(calls.some(c => c.path.endsWith("/history") || c.path === "/api/staff/assignees")).toBe(false);
});
test("dirty Actions guard header, Back, and Ticket hash navigation", async ({ page }) => {
  await mockApi(page, "IT_STAFF"); await page.getByRole("button", { name: "Create Action", exact: true }).click();
  await page.getByLabel("Description (required)").fill("Retained draft");
  page.on("dialog", dialog => void dialog.dismiss());
  // Exercise navigation through the app handlers; the modal also prevents ordinary pointer access to the background.
  await page.getByRole("button", { name: "Ticket Queue", exact: true }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByLabel("Description (required)")).toHaveValue("Retained draft");
  await page.getByRole("button", { name: "Back to Ticket Queue", exact: true }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByLabel("Description (required)")).toHaveValue("Retained draft");
  await page.evaluate(() => { window.location.hash = "#/tickets/102"; });
  await expect(page).toHaveURL(/#\/tickets\/101$/);
  await expect(page.getByLabel("Description (required)")).toHaveValue("Retained draft");
});

test("mobile history wraps snapshots and keeps keyboard focus inside the dialog", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await mockApi(page, "IT_STAFF");
  await page.getByRole("button", { name: "View history" }).click();
  const dialog = page.getByRole("dialog"), summary = dialog.locator("summary");
  await expect(summary).toBeVisible();
  await page.keyboard.press("Shift+Tab"); await expect(summary).toBeFocused();
  await page.keyboard.press("Enter"); await expect(dialog.getByText("User #2", { exact: true })).toBeVisible();
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.keyboard.press("Tab"); await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "View history" })).toBeFocused();
});
