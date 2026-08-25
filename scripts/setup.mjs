#!/usr/bin/env node
/**
 * One-command local bootstrap (Mode A — single Next).
 *   npm run setup
 *   npm run setup -- --db   # also prisma db push + seed
 */
import { copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const withDb = process.argv.includes("--db");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: false });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const envPath = path.join(root, ".env");
if (!existsSync(envPath)) {
  copyFileSync(path.join(root, ".env.example"), envPath);
  console.log("✔ created .env from .env.example");
} else {
  console.log("· .env already exists");
}

run("npm", ["install"]);

if (withDb) {
  run("npx", ["prisma", "db", "push"]);
  run("npm", ["run", "db:seed"]);
  console.log("✔ database pushed and seeded");
}

console.log("\nNext: npm run dev  →  http://localhost:3000");
console.log("Demo: client@ / broker@ / operator@ / admin@ (ADMIN) · demo1234");
console.log("D36: standalone LBM — no nested llm/; docs/knowledge/plan-full-split-ibm-cargo.md");
console.log("Docs: docs/knowledge/environments.md · docs/knowledge/staging.md");
