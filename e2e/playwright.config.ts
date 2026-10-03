import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const database = 'postgresql://lab3_test:lab3_test_local@127.0.0.1:55433/toktickit_lab3_test?schema=public';
if (process.env.DATABASE_URL && process.env.DATABASE_URL !== database) throw new Error('E2E requires the isolated Lab 3 database, never a development URL.');
process.env.DATABASE_URL = database;
export default defineConfig({
  testDir: './lab-03', fullyParallel: false, workers: 1, retries: 0, timeout: 60000,
  expect: { timeout: 10000 }, reporter: [['list']], outputDir: './test-results',
  use: { baseURL: 'http://localhost:5174', browserName: 'chromium', viewport: { width: 1280, height: 800 },
    // Never persist passwords, cookies or session responses in traces/storage state.
    trace: 'off', screenshot: 'off', video: 'off' },
  webServer: [
    { command: 'node node_modules/tsx/dist/cli.mjs tests/lab-03/e2e-server.ts', cwd: path.join(root, 'server'),
      url: 'http://localhost:3101/api/health', reuseExistingServer: false, timeout: 120000,
      env: { DATABASE_URL: database, NODE_ENV: 'test', TEST_UPLOAD_ROOT: 'uploads/lab-03-test',
        AUTH_ALLOW_HTTP_LOCALHOST: 'true', FRONTEND_ORIGIN: 'http://localhost:5174', PORT: '3101' } },
    { command: 'node node_modules/vite/bin/vite.js --host localhost --port 5174 --strictPort', cwd: path.join(root, 'client'),
      url: 'http://localhost:5174', reuseExistingServer: false, env: { VITE_API_URL: 'http://localhost:3101' } },
  ],
});
