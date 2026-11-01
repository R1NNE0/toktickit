import { defineConfig } from "vitest/config";

// Each test owns a new schema. Never import the Lab 3 public-schema reset setup.
export default defineConfig({ test: {
  environment: "node", include: ["tests/lab-04/migration-regression.test.ts"],
  fileParallelism: false, testTimeout: 120000, hookTimeout: 120000,
} });
