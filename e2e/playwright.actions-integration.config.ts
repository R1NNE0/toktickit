import { defineConfig } from '@playwright/test';
import existing from './playwright.config.js';

// Reuse the guarded disposable database, real Express server, Vite server and ports.
export default defineConfig({
  ...existing,
  testDir: './lab-04', testMatch: ['actions-taken-integration.spec.ts', 'ticket-resolution.spec.ts', 'dashboards.spec.ts'],
  outputDir: './test-results/lab4-actions-integration',
});
