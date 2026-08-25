#!/usr/bin/env node
/**
 * TKS archive adapter (stub until TKS_CLIENT_KEY is set).
 *
 * Docs: https://github.com/tkssoft/api.tks.ru-docs/blob/main/TNVED.JSON.md
 *   GET https://api1.tks.ru/tnved.json/json/<key>/ver.json
 *   GET https://api1.tks.ru/tnved.json/json/<key>/archive.zip
 *   GET https://api1.tks.ru/tree.json/json/<key>/archive.zip
 *
 * Usage: npm run tnved:adapter-tks
 */
import fs from "node:fs";
import path from "node:path";
import { TNVED_ROOT, todayStamp, ensureDir, writeJson } from "../tnved-lib.mjs";

const KEY = process.env.TKS_CLIENT_KEY || "";
const BASE = (process.env.TKS_API_BASE || "https://api1.tks.ru").replace(/\/$/, "");

async function main() {
  const outDir = path.join(TNVED_ROOT, "raw", "tks", todayStamp());
  ensureDir(outDir);

  if (!KEY) {
    writeJson(path.join(outDir, "meta.json"), {
      source: "tks",
      status: "skipped",
      reason: "TKS_CLIENT_KEY not set — licensed API required; no public dump",
      docs: "https://github.com/tkssoft/api.tks.ru-docs/blob/main/TNVED.JSON.md",
      endpoints: {
        ver: `${BASE}/tnved.json/json/<key>/ver.json`,
        archive: `${BASE}/tnved.json/json/<key>/archive.zip`,
        treeArchive: `${BASE}/tree.json/json/<key>/archive.zip`,
      },
      fetchedAt: new Date().toISOString(),
    });
    console.log("[tks] skipped — set TKS_CLIENT_KEY to download archive.zip");
    process.exit(0);
  }

  const verUrl = `${BASE}/tnved.json/json/${KEY}/ver.json`;
  const archUrl = `${BASE}/tnved.json/json/${KEY}/archive.zip`;
  console.log(`[tks] fetching ver ${verUrl}`);
  const verRes = await fetch(verUrl, { signal: AbortSignal.timeout(60000) });
  if (!verRes.ok) throw new Error(`ver HTTP ${verRes.status}`);
  const verText = await verRes.text();
  fs.writeFileSync(path.join(outDir, "ver.json"), verText, "utf8");

  console.log(`[tks] fetching archive ${archUrl}`);
  const zipRes = await fetch(archUrl, { signal: AbortSignal.timeout(300000) });
  if (!zipRes.ok) throw new Error(`archive HTTP ${zipRes.status}`);
  const buf = Buffer.from(await zipRes.arrayBuffer());
  fs.writeFileSync(path.join(outDir, "archive.zip"), buf);
  writeJson(path.join(outDir, "meta.json"), {
    source: "tks",
    status: "ok",
    bytes: buf.length,
    fetchedAt: new Date().toISOString(),
  });
  console.log(`[tks] saved archive.zip (${buf.length} bytes) → ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
