#!/usr/bin/env node
/**
 * Export normalized codes.jsonl → batches for LBM POST /api/v1/tnved/import (max 500).
 *
 * Usage: npm run tnved:export-import
 * Does NOT call LBM — dry files only. Set LBM_TNVED_IMPORT_URL + cookie/token later.
 */
import fs from "node:fs";
import path from "node:path";
import { TNVED_ROOT, ensureDir, readJsonl, writeJson, displayCode, parentCodeOf, levelFromCode } from "./tnved-lib.mjs";

const BATCH = Math.min(500, Number(process.env.TNVED_IMPORT_BATCH || 500));

function toImportItem(row) {
  const code = String(row.code || "").replace(/\D/g, "");
  const item = {
    code,
    codeDisplay: row.codeDisplay || displayCode(code),
    level: row.level || levelFromCode(code),
    parentCode: row.parentCode ?? parentCodeOf(code),
    titleRu: row.titleRu || code,
    titleEn: row.titleEn || undefined,
    isLeaf: Boolean(row.isLeaf),
    isActive: row.isActive !== false,
    notes: row.notes || undefined,
  };
  if (row.duty && (row.duty.dutyPct != null || row.duty.vatPct != null || row.duty.note)) {
    item.rate = {
      dutyKind: row.duty.dutyKind || "AD_VALOREM",
      dutyPct: row.duty.dutyPct ?? null,
      vatPct: row.duty.vatPct ?? null,
      feeHintRub: row.duty.feeHintRub ?? null,
      source: row.duty.source || row.source || "llm-corpus",
    };
    if (row.duty.note) item.notes = [item.notes, `Тариф: ${row.duty.note}`].filter(Boolean).join("\n");
  }
  return item;
}

async function main() {
  const codesPath = path.join(TNVED_ROOT, "normalized", "codes.jsonl");
  const rows = readJsonl(codesPath);
  if (!rows.length) {
    console.error("[export] no codes — run npm run tnved:normalize first");
    process.exit(1);
  }

  const outDir = path.join(TNVED_ROOT, "export", "batches");
  ensureDir(outDir);
  // clear old batches
  for (const f of fs.readdirSync(outDir)) {
    if (f.startsWith("import-") && f.endsWith(".json")) fs.unlinkSync(path.join(outDir, f));
  }

  const items = rows.map(toImportItem);
  let batchIdx = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    batchIdx++;
    const file = path.join(outDir, `import-${String(batchIdx).padStart(4, "0")}.json`);
    writeJson(file, { items: chunk });
  }

  const manifest = {
    exportedAt: new Date().toISOString(),
    totalItems: items.length,
    batchSize: BATCH,
    batchCount: batchIdx,
    lbmEndpoint: "POST /api/v1/tnved/import (ADMIN)",
    note: "Dry-run files only. Upload with admin session; do not auto-post to prod.",
  };
  writeJson(path.join(TNVED_ROOT, "export", "manifest.json"), manifest);
  console.log(`[export] ${items.length} items → ${batchIdx} batches in ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
