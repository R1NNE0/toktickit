import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "node", include: ["tests/lab-03/**/*.test.ts", "tests/lab-01/**/*.test.ts"],
    fileParallelism: false, globalSetup: ["tests/lab-03/global-setup.ts"], setupFiles: ["tests/lab-03/setup.ts"], testTimeout: 30000, hookTimeout: 60000 },
});
