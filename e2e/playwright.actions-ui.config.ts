import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// UI-only browser checks: API routes are intercepted with synthetic responses.
// This configuration starts no backend, migration, seed, or database connection.
export default defineConfig({
  testDir: "./lab-04", testMatch: "actions-taken-ui.spec.ts", workers: 1, retries: 0, timeout: 30000,
  reporter: "list", outputDir: "./test-results/lab4-actions-ui",
  use: { baseURL: "http://localhost:5175", browserName: "chromium", trace: "off", screenshot: "off", video: "off" },
  webServer: { command: "node node_modules/vite/bin/vite.js --host localhost --port 5175 --strictPort", cwd: path.join(root, "client"),
    url: "http://localhost:5175", reuseExistingServer: false, env: { VITE_API_URL: "http://localhost:3102" } },
});
