#!/usr/bin/env node
/**
 * Parse FTS open-data datasets → raw/fts-opendata/<date>/rates.jsonl
 * (code → vat/excise/preference overlays)
 *
 * Usage: npm run tnved:parse-fts
 */
import fs from "node:fs";
import path from "node:path";
import { TNVED_ROOT, writeJsonl, writeJson, digitsOnly, htmlToText } from "./tnved-lib.mjs";

function latestDir(base) {
  if (!fs.existsSync(base)) return null;
  const dirs = fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return dirs.length ? path.join(base, dirs[dirs.length - 1]) : null;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const delim = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const split = (line) => {
    const cols = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        q = !q;
        continue;
      }
      if (ch === delim && !q) {
        cols.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  };
  const header = split(lines[0]).map((h) => h.toLowerCase());
  const rows = [];
  for (const line of lines.slice(1)) {
    const cols = split(line);
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = cols[i] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

function pick(obj, names) {
  for (const n of names) {
    if (obj[n] != null && String(obj[n]).trim() !== "") return obj[n];
    const found = Object.keys(obj).find((k) => k.includes(n));
    if (found && String(obj[found]).trim() !== "") return obj[found];
  }
  return null;
}

function rowToRate(obj) {
  const codeRaw = pick(obj, ["code", "код", "tnved", "тнвэд", "hs", "kod"]);
  const code = digitsOnly(String(codeRaw || ""));
  if (code.length < 4 || code.length > 10) return null;
  const vat = pick(obj, ["vat", "ндс", "nds", "vatpct"]);
  const excise = pick(obj, ["excise", "акциз", "akciz"]);
  const pref = pick(obj, ["pref", "преферен", "preference", "льгот"]);
  const duty = pick(obj, ["duty", "пошлин", "stavka", "rate"]);
  const num = (v) => {
    if (v == null) return null;
    const m = String(v).replace(",", ".").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  };
  return {
    code: code.length === 10 ? code : code,
    source: "fts-opendata",
    duty: {
      dutyPct: num(duty),
      vatPct: num(vat),
      excise: excise != null ? String(excise) : null,
      preferenceNote: pref != null ? String(pref) : null,
      source: "fts-opendata",
    },
  };
}

function parseFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const rates = [];
  if (file.endsWith(".json") || text.trimStart().startsWith("[") || text.trimStart().startsWith("{")) {
    try {
      const data = JSON.parse(text);
      const rows = Array.isArray(data) ? data : data.items || data.data || data.records || [];
      for (const r of rows) {
        const flat = {};
        for (const [k, v] of Object.entries(r)) flat[String(k).toLowerCase()] = v;
        const rate = rowToRate(flat);
        if (rate) rates.push(rate);
      }
    } catch {
      /* ignore */
    }
    return rates;
  }
  if (file.endsWith(".csv") || text.includes(";") || text.includes(",")) {
    for (const row of parseCsv(text)) {
      const rate = rowToRate(row);
      if (rate) rates.push(rate);
    }
    return rates;
  }
  if (file.endsWith(".xml") || text.trimStart().startsWith("<")) {
    const codeTags = [...text.matchAll(/<(?:CODE|Kod|код|TnvedCode)[^>]*>([^<]+)<\//gi)];
    for (const m of codeTags) {
      const code = digitsOnly(m[1]);
      if (code.length >= 4) rates.push({ code, source: "fts-opendata", duty: { source: "fts-opendata" } });
    }
    return rates;
  }
  // plain text scan
  for (const line of text.split(/\n/)) {
    const d = digitsOnly(line).slice(0, 10);
    if (d.length === 10) rates.push({ code: d, source: "fts-opendata", duty: { source: "fts-opendata" } });
  }
  return rates;
}

async function main() {
  const ftsDir = latestDir(path.join(TNVED_ROOT, "raw", "fts-opendata"));
  if (!ftsDir) {
    console.error("[parse-fts] no raw/fts-opendata — run tnved:fetch-fts first");
    process.exit(1);
  }
  const dsDir = path.join(ftsDir, "datasets");
  const outFile = path.join(ftsDir, "rates.jsonl");
  const metaFile = path.join(ftsDir, "rates-meta.json");

  if (!fs.existsSync(dsDir)) {
    writeJsonl(outFile, []);
    writeJson(metaFile, { status: "gap", reason: "no datasets/", parsedAt: new Date().toISOString() });
    console.log("[parse-fts] gap — no datasets");
    return;
  }

  const files = fs.readdirSync(dsDir).filter((f) => !f.startsWith("."));
  const map = new Map();
  for (const f of files) {
    if (f.endsWith(".zip") || f.endsWith(".bin")) {
      console.warn(`[parse-fts] skip binary ${f} (unzip manually into datasets/)`);
      continue;
    }
    const pathF = path.join(dsDir, f);
    let rates = [];
    try {
      rates = parseFile(pathF);
    } catch (e) {
      console.warn(`[parse-fts] fail ${f}:`, e.message || e);
    }
    console.log(`[parse-fts] ${f}: ${rates.length}`);
    for (const r of rates) map.set(r.code, r);
  }

  const list = [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  writeJsonl(outFile, list);
  writeJson(metaFile, {
    status: list.length ? "ok" : "empty",
    codes: list.length,
    files: files.length,
    parsedAt: new Date().toISOString(),
  });
  console.log(`[parse-fts] wrote ${list.length} → ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
