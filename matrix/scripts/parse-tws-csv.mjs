#!/usr/bin/env node
/**
 * Parse local TWS / third-party TN VED leaf CSV into raw/tws-tnved/<date>/.
 * Not a web scraper — reads a file already on disk.
 *
 * Expected columns: Код, Наименование, Тариф, Подробности
 *
 * Usage: npm run tnved:parse-tws
 * Env: TWS_TNVED_CSV — path to CSV (default: first matching *TNVED*.csv / *ТНВЭД*.csv in repo root)
 */
import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  TNVED_ROOT,
  todayStamp,
  ensureDir,
  writeJson,
  writeJsonl,
  digitsOnly,
  levelFromCode,
  parentCodeOf,
  displayCode,
} from "./tnved-lib.mjs";

function findDefaultCsv() {
  if (process.env.TWS_TNVED_CSV) return process.env.TWS_TNVED_CSV;
  const names = fs.readdirSync(ROOT);
  const hit = names.find(
    (n) =>
      /\.csv$/i.test(n) &&
      (/tnved/i.test(n) || /тнвэд/i.test(n) || /TWS_TNVED/i.test(n)),
  );
  return hit ? path.join(ROOT, hit) : null;
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Parse tariff text → structured duty. */
export function parseTariff(tariffRaw) {
  const tariff = String(tariffRaw || "").trim();
  if (!tariff) return null;

  const note = tariff;
  const pctM = tariff.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const dutyPct = pctM ? Number(pctM[1].replace(",", ".")) : null;
  const hasEuro = /EUR|евро|€/i.test(tariff);
  const hasUsd = /USD|\$|доллар/i.test(tariff);
  const hasMin = /не\s+менее/i.test(tariff);

  let dutyKind = "AD_VALOREM";
  if ((hasEuro || hasUsd) && dutyPct != null) dutyKind = "MIXED";
  else if (hasEuro || hasUsd) dutyKind = "SPECIFIC";
  else if (dutyPct == null) dutyKind = "OTHER";

  return {
    dutyKind,
    dutyPct,
    vatPct: null,
    specificUnit: hasEuro ? "EUR" : hasUsd ? "USD" : null,
    hasMinimum: hasMin,
    note,
    source: "tws-csv",
  };
}

function cleanTitle(title) {
  return String(title || "")
    .replace(/[\u{1F83A}\u{1F81A}]/gu, "→")
    .replace(/\s+/g, " ")
    .trim();
}

function loadRows(csvPath) {
  const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const idx = {
    code: header.findIndex((h) => /^код$/i.test(h) || /^code$/i.test(h)),
    title: header.findIndex((h) => /наименован/i.test(h) || /^title/i.test(h)),
    tariff: header.findIndex((h) => /тариф/i.test(h) || /duty|rate/i.test(h)),
  };
  if (idx.code < 0) throw new Error(`No Код column in ${csvPath}; got ${header.join("|")}`);

  const rows = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const code = digitsOnly(cols[idx.code] || "");
    if (code.length !== 10) continue;
    const titleRu = cleanTitle(idx.title >= 0 ? cols[idx.title] : "");
    const tariff = idx.tariff >= 0 ? cols[idx.tariff] : "";
    rows.push({
      code,
      codeDisplay: displayCode(code),
      level: 10,
      parentCode: parentCodeOf(code),
      titleRu: titleRu || code,
      titleEn: null,
      isLeaf: true,
      isActive: true,
      notes: null,
      source: "tws-csv",
      sourceUrl: null,
      fetchedAt: null,
      duty: parseTariff(tariff),
      tariffRaw: String(tariff || "").trim() || null,
    });
  }
  return rows;
}

async function main() {
  const csvPath = findDefaultCsv();
  if (!csvPath || !fs.existsSync(csvPath)) {
    const stamp = todayStamp();
    const outDir = path.join(TNVED_ROOT, "raw", "tws-tnved", stamp);
    ensureDir(outDir);
    writeJson(path.join(outDir, "meta.json"), {
      source: "tws-csv",
      status: "gap",
      gap: "CSV not found. Place TWS_TNVED_*.csv in repo root or set TWS_TNVED_CSV.",
      fetchedAt: new Date().toISOString(),
    });
    console.warn("[parse-tws] GAP: no CSV — skip (corpus continues)");
    process.exit(0);
  }

  const stamp = todayStamp();
  const outDir = path.join(TNVED_ROOT, "raw", "tws-tnved", stamp);
  ensureDir(outDir);

  const destCsv = path.join(outDir, "tnved.csv");
  fs.copyFileSync(csvPath, destCsv);

  const rows = loadRows(destCsv);
  const fetchedAt = new Date().toISOString();
  for (const r of rows) r.fetchedAt = fetchedAt;

  writeJsonl(path.join(outDir, "codes.jsonl"), rows);

  const withPct = rows.filter((r) => r.duty?.dutyPct != null).length;
  const meta = {
    source: "tws-csv",
    fetchedAt,
    inputPath: csvPath,
    copiedTo: destCsv,
    rows: rows.length,
    withDutyPct: withPct,
    note: "Third-party leaf dump (not EEC NSI). Used as fill until СТНВЭДСТ XML is available. Do not scrape web mirrors.",
  };
  writeJson(path.join(outDir, "meta.json"), meta);
  console.log(`[parse-tws] ${rows.length} leaves (${withPct} with %) → ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
