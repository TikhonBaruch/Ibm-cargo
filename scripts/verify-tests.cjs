#!/usr/bin/env node
/**
 * Additional test control gate (beyond vitest itself).
 * 1) Runs unit suite
 * 2) Asserts minimum pass count / zero failures
 * 3) Checks e2e folder presence
 *
 * Exit codes:
 *  0 — ok
 *  1 — unit failures
 *  2 — inventory / policy failure
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function run(cmd, args, label) {
  console.log(`\n▶ ${label}\n`);
  const res = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  process.stdout.write(res.stdout || "");
  process.stderr.write(res.stderr || "");
  return res;
}

const unit = run("npx", ["vitest", "run", "src"], "Unit + security tests (src/)");
if (unit.status !== 0) {
  console.error("\n✖ test:verify failed: unit suite");
  process.exit(1);
}

const out = `${unit.stdout || ""}\n${unit.stderr || ""}`;
const m = out.match(/Tests\s+(\d+)\s+passed/);
const passed = m ? Number(m[1]) : 0;
const MIN_PASSED = 90;
if (passed < MIN_PASSED) {
  console.error(`\n✖ test:verify policy: expected ≥ ${MIN_PASSED} passed tests, got ${passed}`);
  process.exit(2);
}

const e2eDir = path.join(root, "tests", "e2e");
if (!fs.existsSync(e2eDir)) {
  console.error("\n✖ missing tests/e2e — optional network suite must be present");
  process.exit(2);
}

console.log(`\n✔ test:verify OK (${passed} passed, threshold ${MIN_PASSED})`);
process.exit(0);
