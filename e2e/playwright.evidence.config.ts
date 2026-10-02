import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// Opt-in evidence capture. The normal Lab 3 regression runner is unchanged.
export default defineConfig({
  ...base,
  testDir: './evidence',
  testMatch: '**/*.capture.spec.ts',
  timeout: 180000,
  outputDir: './test-results/evidence',
});
