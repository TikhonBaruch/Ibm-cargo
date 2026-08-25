import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "containers/**", "**/e2e/**", "**/*.integration.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    reporters: ["default"],
    testTimeout: 15_000,
    // threads + fileParallelism off avoid fork kill EACCES in restricted sandboxes/CI
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
