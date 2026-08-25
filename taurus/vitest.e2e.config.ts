import { defineConfig } from "vitest/config";
import path from "path";

/** Opt-in network e2e — not part of test:ci. Run: npm run test:e2e */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/e2e/**/*.e2e.test.ts"],
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
