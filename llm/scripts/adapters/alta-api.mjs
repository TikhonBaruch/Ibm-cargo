#!/usr/bin/env node
/**
 * Alta-Soft API adapter (stub until credentials are set).
 *
 * Public HTML/API are commercial — no open dump; do not HTML-scrape alta.ru/tnved.
 * See https://www.alta.ru/online-services/ and http://www.tnved.online/
 * Same policy for tnved.info / classifikators.ru — licensed or local CSV only (tnved:parse-tws).
 *
 * Usage: npm run tnved:adapter-alta
 * Env: ALTA_API_URL, ALTA_LOGIN, ALTA_PASSWORD (or ALTA_API_TOKEN)
 */
import path from "node:path";
import { TNVED_ROOT, todayStamp, ensureDir, writeJson } from "../tnved-lib.mjs";

const URL = process.env.ALTA_API_URL || "";
const LOGIN = process.env.ALTA_LOGIN || "";
const PASSWORD = process.env.ALTA_PASSWORD || "";
const TOKEN = process.env.ALTA_API_TOKEN || "";

async function main() {
  const outDir = path.join(TNVED_ROOT, "raw", "alta", todayStamp());
  ensureDir(outDir);

  if (!URL || (!TOKEN && !(LOGIN && PASSWORD))) {
    writeJson(path.join(outDir, "meta.json"), {
      source: "alta",
      status: "skipped",
      reason: "ALTA_API_URL + (ALTA_API_TOKEN or ALTA_LOGIN/PASSWORD) required — licensed; no public dump",
      refs: [
        "https://www.alta.ru/online-services/",
        "https://www.alta.ru/tnved/",
        "https://www.alta.ru/poyasnenia/PRED/",
        "http://www.tnved.online/",
      ],
      fetchedAt: new Date().toISOString(),
    });
    console.log("[alta] skipped — set ALTA_* credentials to enable");
    process.exit(0);
  }

  // Placeholder: vendor-specific REST differs by contract; keep hook explicit.
  writeJson(path.join(outDir, "meta.json"), {
    source: "alta",
    status: "not_implemented",
    message: "Credentials present but request shape depends on contracted Alta XML-API product. Wire method per your ЛК docs.",
    apiUrl: URL,
    fetchedAt: new Date().toISOString(),
  });
  console.log("[alta] credentials detected — implement product-specific call per Alta contract docs");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
