import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { fixture } from "./api-fixtures.js";
import { assertTestEnvironment } from "../lab-03/safety.js";

it("starts the package production entry and serves health and an authenticated read", async () => {
  assertTestEnvironment();
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const pkg = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const command = /^node (dist\/[\w/.-]+\.js)$/.exec(pkg.scripts.start);
  expect(command, "Production start must identify the actual built Node entry").not.toBeNull();
  // Keep this regression executable in a fresh checkout without relying on a
  // stale or pre-existing dist tree from a previous developer build.
  execFileSync(process.execPath, ["node_modules/typescript/bin/tsc"], { cwd: root, windowsHide: true });
  const f = await fixture();
  const child = spawn(process.execPath, [command![1]], { cwd: root, windowsHide: true,
    env: { ...process.env, PORT: "3103" }, stdio: ["ignore", "ignore", "pipe"] });
  let error = ""; child.stderr.on("data", data => { error += data.toString(); });
  try {
    let health: Response | undefined;
    for (let i = 0; i < 50; i++) {
      if (child.exitCode !== null) throw new Error("Production entry exited before listening: " + error);
      try { health = await fetch("http://localhost:3103/api/health"); break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    expect(health?.status, error).toBe(200);
    const response = await fetch("http://localhost:3103/api/dashboard/staff", { headers: f.staffHeaders });
    expect(response.status).toBe(200); expect((await response.json()).timezone).toBe("Asia/Bangkok");
  } finally {
    if (child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
  }
});
