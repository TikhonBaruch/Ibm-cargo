#!/usr/bin/env node
/**
 * Sync AI capability mirrors: llm repo → taurus/containers/{llm,ocr}.
 * Canon: /home/andrey/llm/services/{classification,ocr}
 * Usage:
 *   node scripts/sync-ai-matrix.cjs           # copy
 *   node scripts/sync-ai-matrix.cjs --check   # exit 2 if drift (when ./llm exists)
 *   node scripts/sync-ai-matrix.cjs --dry-run
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const matrixRoot = path.resolve(root, "llm");
const dryRun = process.argv.includes("--dry-run");
const checkOnly = process.argv.includes("--check");

const pairs = [
  {
    name: "classification→llm",
    from: path.join(matrixRoot, "services/classification"),
    to: path.join(root, "containers/llm"),
    files: [
      "package.json",
      "Dockerfile",
      "src/index.js",
      "src/openai-compat.js",
      "src/tnved-lookup.js",
      "src/customs-fees.js",
      "src/openai-compat.test.js",
    ],
  },
  {
    name: "ocr→ocr",
    from: path.join(matrixRoot, "services/ocr"),
    to: path.join(root, "containers/ocr"),
    files: [
      "package.json",
      "package-lock.json",
      "Dockerfile",
      "src/index.js",
      "src/qwen-session.js",
      "src/qwen-session.test.js",
      "src/deepseek-session.js",
      "src/vision-route.js",
      "src/vision-route.test.js",
    ],
  },
];

function sha(file) {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function listOptionalTests(fromDir) {
  const extras = [];
  const srcDir = path.join(fromDir, "src");
  if (!fs.existsSync(srcDir)) return extras;
  for (const name of fs.readdirSync(srcDir)) {
    if (name.endsWith(".test.js")) extras.push(`src/${name}`);
  }
  return extras;
}

if (!fs.existsSync(matrixRoot)) {
  if (checkOnly) {
    console.log("sync-ai-matrix: ./llm missing — skip check");
    process.exit(0);
  }
  console.error("sync-ai-matrix: expected llm package at", matrixRoot);
  process.exit(1);
}

let drift = 0;
let copied = 0;

for (const pair of pairs) {
  if (!fs.existsSync(pair.from)) {
    console.error(`missing source ${pair.from}`);
    process.exit(1);
  }
  const files = [...new Set([...pair.files, ...listOptionalTests(pair.from)])];
  for (const rel of files) {
    const src = path.join(pair.from, rel);
    const dst = path.join(pair.to, rel);
    if (!fs.existsSync(src)) continue;
    const a = sha(src);
    const b = sha(dst);
    if (a === b) continue;
    drift++;
    if (checkOnly) {
      console.error(`drift ${pair.name}: ${rel}`);
      continue;
    }
    console.log(`${dryRun ? "would copy" : "copy"} ${pair.name}: ${rel}`);
    if (!dryRun) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      copied++;
    }
  }
}

if (checkOnly) {
  if (drift) {
    console.error(`\nsync-ai-matrix --check: ${drift} file(s) differ. Run: npm run sync:ai-matrix\n`);
    process.exit(2);
  }
  console.log("✔ sync-ai-matrix --check OK (mirrors match matrix)");
  process.exit(0);
}

console.log(
  dryRun
    ? `dry-run: ${drift} file(s) would sync`
    : `✔ synced ${copied} file(s) from llm matrix (${drift} differed)`
);
