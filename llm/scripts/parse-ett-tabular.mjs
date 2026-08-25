#!/usr/bin/env node
/**
 * Parse EEC ETT Excel sheets (if any) → raw/eec-ett/<date>/tabular.jsonl
 * Minimal XLSX reader without native deps: unzip + sharedStrings + sheet XML.
 *
 * Usage: npm run tnved:parse-ett
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  TNVED_ROOT,
  ensureDir,
  writeJsonl,
  writeJson,
  digitsOnly,
  displayCode,
  levelFromCode,
  parentCodeOf,
  htmlToText,
} from "./tnved-lib.mjs";

function latestDir(base) {
  if (!fs.existsSync(base)) return null;
  const dirs = fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return dirs.length ? path.join(base, dirs[dirs.length - 1]) : null;
}

function unzipList(xlsxPath, destDir) {
  ensureDir(destDir);
  try {
    execFileSync("unzip", ["-o", "-q", xlsxPath, "-d", destDir], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function readSharedStrings(dir) {
  const f = path.join(dir, "xl", "sharedStrings.xml");
  if (!fs.existsSync(f)) return [];
  const xml = fs.readFileSync(f, "utf8");
  const out = [];
  const re = /<si[\s\S]*?<\/si>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const texts = [...m[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/gi)].map((x) => htmlToText(x[1]));
    out.push(texts.join(""));
  }
  return out;
}

function colRow(ref) {
  const m = String(ref).match(/^([A-Z]+)(\d+)$/i);
  if (!m) return { col: 0, row: 0 };
  const letters = m[1].toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i++) col = col * 26 + (letters.charCodeAt(i) - 64);
  return { col: col - 1, row: Number(m[2]) - 1 };
}

function readSheetRows(dir, shared) {
  const sheetsDir = path.join(dir, "xl", "worksheets");
  if (!fs.existsSync(sheetsDir)) return [];
  const sheetFile = fs.readdirSync(sheetsDir).find((f) => f.endsWith(".xml"));
  if (!sheetFile) return [];
  const xml = fs.readFileSync(path.join(sheetsDir, sheetFile), "utf8");
  const grid = new Map();
  const cellRe = /<c r="([A-Z]+\d+)"([^>]*)>(?:[\s\S]*?<v>([\s\S]*?)<\/v>)?/gi;
  let m;
  while ((m = cellRe.exec(xml))) {
    const { col, row } = colRow(m[1]);
    const attrs = m[2] || "";
    let val = m[3] != null ? m[3] : "";
    if (/t="s"/.test(attrs) && shared[Number(val)] != null) val = shared[Number(val)];
    if (!grid.has(row)) grid.set(row, []);
    grid.get(row)[col] = String(val).trim();
  }
  return [...grid.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, cols]) => cols);
}

function rowsToCodes(rows) {
  const out = [];
  for (const cols of rows) {
    if (!cols || !cols.length) continue;
    const joined = cols.filter(Boolean).join(" | ");
    // find first cell that looks like HS code
    let code = null;
    let title = null;
    let dutyRaw = null;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (!c) continue;
      const d = digitsOnly(c.replace(/\s/g, ""));
      if (d.length >= 2 && d.length <= 10 && d.length % 2 === 0 && /^\d+$/.test(d) && !code) {
        code = d;
        title = cols.slice(i + 1).find((x) => x && !/^\d+([.,]\d+)?%?$/.test(x)) || null;
        dutyRaw = cols.slice(i + 1).find((x) => /\d/.test(x) && /%|евро|долл|руб/i.test(x)) || null;
        break;
      }
    }
    if (!code) continue;
    if (code.length > 10) continue;
    const dutyPctMatch = dutyRaw && dutyRaw.match(/(\d+[.,]?\d*)\s*%/);
    out.push({
      code,
      codeDisplay: displayCode(code),
      level: levelFromCode(code),
      parentCode: parentCodeOf(code),
      titleRu: title || joined,
      isLeaf: levelFromCode(code) === 10,
      isActive: true,
      source: "eec-ett",
      duty: dutyPctMatch
        ? { dutyKind: "AD_VALOREM", dutyPct: Number(dutyPctMatch[1].replace(",", ".")), source: "eec-ett" }
        : dutyRaw
          ? { note: dutyRaw, source: "eec-ett" }
          : null,
    });
  }
  return out;
}

async function main() {
  const ettDir = latestDir(path.join(TNVED_ROOT, "raw", "eec-ett"));
  if (!ettDir) {
    console.error("[parse-ett] no raw/eec-ett — run tnved:fetch-ett first");
    process.exit(1);
  }
  const sheetsDir = path.join(ettDir, "sheets");
  const outFile = path.join(ettDir, "tabular.jsonl");
  const metaFile = path.join(ettDir, "tabular-meta.json");

  if (!fs.existsSync(sheetsDir)) {
    writeJson(metaFile, {
      status: "skipped",
      reason: "no sheets/ directory — EEC page usually publishes PDF only",
      ettDir,
      parsedAt: new Date().toISOString(),
    });
    writeJsonl(outFile, []);
    console.log("[parse-ett] skipped (no XLSX)");
    return;
  }

  const files = fs.readdirSync(sheetsDir).filter((f) => /\.xlsx?$/i.test(f));
  if (!files.length) {
    writeJson(metaFile, { status: "skipped", reason: "sheets/ empty", parsedAt: new Date().toISOString() });
    writeJsonl(outFile, []);
    console.log("[parse-ett] skipped (empty sheets)");
    return;
  }

  const all = [];
  for (const f of files) {
    const xlsxPath = path.join(sheetsDir, f);
    const extractDir = path.join(ettDir, ".xlsx-extract", f.replace(/\W+/g, "_"));
    if (!unzipList(xlsxPath, extractDir)) {
      console.warn(`[parse-ett] unzip failed for ${f} (need unzip binary)`);
      continue;
    }
    const shared = readSharedStrings(extractDir);
    const rows = readSheetRows(extractDir, shared);
    const codes = rowsToCodes(rows);
    console.log(`[parse-ett] ${f}: rows=${rows.length} codes=${codes.length}`);
    all.push(...codes);
  }

  // dedupe by code (last wins)
  const map = new Map();
  for (const r of all) map.set(r.code, r);
  const list = [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  writeJsonl(outFile, list);
  writeJson(metaFile, {
    status: list.length ? "ok" : "empty",
    files: files.length,
    codes: list.length,
    parsedAt: new Date().toISOString(),
    outFile,
  });
  console.log(`[parse-ett] wrote ${list.length} → ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
