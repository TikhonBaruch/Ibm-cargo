import { defineConfig } from "vitest/config";
import path from "path";

/** Opt-in DB integration — not part of test:ci. Run: npm run test:integration */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    reporters: ["default"],
    testTimeout: 30_000,
    pool: "threads",
    fileParallelism: false,
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
