#!/usr/bin/env node
/**
 * Standalone MVP spine: sequential prod/preview smoke bundle (D27 go-live).
 * No UI changes; no live payments. Requires running app + seeded broker.
 *
 *   npm run smoke:standalone
 *   TEST_API_URL=https://<preview-url> npm run smoke:standalone
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const base = process.env.TEST_API_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

const steps = [
  { name: "smoke:mvp", script: "smoke-mvp-path.mjs" },
  { name: "smoke:payments", script: "smoke-payments-path.mjs" },
  { name: "smoke:client", script: "smoke-client-path.mjs" },
  { name: "smoke:broker", script: "smoke-broker-path.mjs" },
  { name: "smoke:full", script: "smoke-full-path.mjs" },
];

console.log(`[smoke:standalone] base=${base}`);
let failed = false;

for (const step of steps) {
  console.log(`\n[smoke:standalone] → ${step.name}`);
  const res = spawnSync(process.execPath, [path.join(__dirname, step.script)], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, TEST_API_URL: base, NEXTAUTH_URL: base },
  });
  if (res.status !== 0) {
    console.error(`[smoke:standalone] FAIL ${step.name} (exit ${res.status ?? "signal"})`);
    failed = true;
    break;
  }
  console.log(`[smoke:standalone] OK ${step.name}`);
}

if (failed) process.exit(1);
console.log("\n[smoke:standalone] all spine steps PASS");
