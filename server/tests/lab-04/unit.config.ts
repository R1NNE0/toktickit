import { defineConfig } from "vitest/config";

// Pure domain checks deliberately do not import the database-reset global setup.
export default defineConfig({
  test: { environment: "node", include: ["tests/lab-04/*.unit.test.ts"], fileParallelism: false },
});
