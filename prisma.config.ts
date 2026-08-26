import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

/**
 * Prisma 6.19 CLI config (replaces deprecated package.json#prisma).
 * Datasource URL stays in prisma/schema.prisma via env("DATABASE_URL") —
 * do not commit a DB URL here. Do not bump to Prisma 7.
 *
 * When this file exists, Prisma CLI skips its own .env loader — restore
 * the historic `.env` / `prisma/.env` lookup so local `db seed` still works.
 * Cwd = repo root. Do not load `app/.env` (`app/` is App Router, not a package).
 * `loadEnvFile` does not override an existing `process.env.DATABASE_URL`
 * (Cloud/Vercel often injects the placeholder `[SENSITIVE]` — use `env -u DATABASE_URL`).
 */
for (const file of [".env", "prisma/.env"]) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});
