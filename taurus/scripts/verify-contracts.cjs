#!/usr/bin/env node
/**
 * Lightweight contract gate for docs/contracts envelopes (branch interaction).
 * No AJV dependency — parse JSON, require metadata + examples/definitions shape.
 * Exit 2 on failure (same convention as verify-structure).
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const errors = [];

const REQUIRED = [
  "docs/contracts/README.md",
  "docs/contracts/d-draft.ai.json",
  "docs/contracts/d-draft.llm.json",
  "docs/contracts/d-calc.client.json",
  "docs/contracts/d-queue.broker.json",
  "docs/contracts/d-map.broker.json",
  "docs/contracts/d-thread.chat.json",
  "docs/contracts/d-ledger.json",
  "docs/contracts/d-event.notify.json",
  "docs/contracts/d-job.worker.json",
  "docs/contracts/d-ship.logistics.json",
  "docs/contracts/d-product.calc.json",
  "docs/contracts/d-tnved.core.json",
  "docs/contracts/d-history.calc.json",
  "docs/contracts/d-orch.core.json",
  "docs/contracts/d-ocr.ai.json",
  "docs/contracts/d-sku.manufacturer.json",
  "docs/contracts/d-sku.catalog.json",
  "docs/contracts/d-order.consolidate.json",
  "docs/contracts/d-admin.actors.json",
  "docs/contracts/d-manufacturer.directory.json",
  "docs/contracts/d-attr.suggest.json",
  "docs/contracts/d-ai.pipeline.json",
];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

for (const f of REQUIRED) {
  if (!exists(f)) errors.push(`missing contract file: ${f}`);
}

const jsonFiles = REQUIRED.filter((f) => f.endsWith(".json"));

for (const rel of jsonFiles) {
  if (!exists(rel)) continue;
  let doc;
  try {
    doc = JSON.parse(read(rel));
  } catch (e) {
    errors.push(`${rel}: invalid JSON (${e.message})`);
    continue;
  }

  if (!doc.$schema) errors.push(`${rel}: missing $schema`);
  if (doc["x-contractVersion"] == null) errors.push(`${rel}: missing x-contractVersion`);
  if (!doc["x-owner"]) errors.push(`${rel}: missing x-owner`);
  if (!doc.definitions || typeof doc.definitions !== "object") {
    errors.push(`${rel}: missing definitions`);
  }
  if (!doc.examples || typeof doc.examples !== "object") {
    errors.push(`${rel}: missing examples`);
  }

  const defs = doc.definitions || {};
  const examples = doc.examples || {};

  for (const [exName, exVal] of Object.entries(examples)) {
    if (exVal == null || typeof exVal !== "object" || Array.isArray(exVal)) continue;
    // Only validate when example name matches a definition exactly
    const def = defs[exName];
    if (!def || !Array.isArray(def.required)) continue;
    for (const key of def.required) {
      if (!(key in exVal)) {
        errors.push(`${rel}: examples.${exName} missing required key "${key}" (from definitions.${exName})`);
      }
    }
  }
}

if (errors.length) {
  console.error("✖ test:contracts failed:");
  for (const e of errors) console.error("  -", e);
  process.exit(2);
}

console.log("✔ test:contracts OK (", jsonFiles.length, "envelopes )");
