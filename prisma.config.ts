import { defineConfig } from "prisma/config";

/**
 * Prisma 6.19 CLI config (replaces deprecated package.json#prisma).
 * Datasource URL stays in prisma/schema.prisma via env("DATABASE_URL") —
 * do not commit a DB URL here. Do not bump to Prisma 7.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});
