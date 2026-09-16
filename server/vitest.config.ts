import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    setupFiles: ["tests/lab-03/setup.ts"],
    globalSetup: ["tests/lab-03/global-setup.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
