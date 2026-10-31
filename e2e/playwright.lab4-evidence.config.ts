import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// Explicitly exclude the historical Lab 3 capture, which writes protected evidence.
export default defineConfig({
  ...base, testDir: './evidence', testMatch: 'lab-04.capture.spec.ts', timeout: 180000,
  outputDir: './test-results/lab4-evidence',
});
