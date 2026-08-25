#!/usr/bin/env node
/**
 * Fetch EEC ETT index (ТН ВЭД + ЕТТ Decision 80) — PDF + optional XLSX.
 * Source: https://eec.eaeunion.org/comission/department/catr/ett/
 *
 * Usage: npm run tnved:fetch-ett
 * Env:
 *   ETT_DOWNLOAD_PDF=1  — download PDFs into pdfs/
 *   ETT_DOWNLOAD_SHEETS=1 — download .xlsx/.xls into sheets/ (default on if found)
 *   ETT_MAX_FILES — limit downloads (default unlimited)
 */
import fs from "node:fs";
import path from "node:path";
import {
  TNVED_ROOT,
  todayStamp,
  ensureDir,
  writeJson,
  fetchText,
  sleep,
  htmlToText,
} from "./tnved-lib.mjs";

const ETT_URL = process.env.ETT_URL || "https://eec.eaeunion.org/comission/department/catr/ett/";
const DELAY_MS = Number(process.env.ETT_DELAY_MS || 300);
const DOWNLOAD_PDF = process.env.ETT_DOWNLOAD_PDF === "1";
const DOWNLOAD_SHEETS = process.env.ETT_DOWNLOAD_SHEETS !== "0";
const MAX_FILES = process.env.ETT_MAX_FILES ? Number(process.env.ETT_MAX_FILES) : Infinity;

function absoluteUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function parseFileLinks(html, baseUrl) {
  const pdfs = [];
  const sheets = [];
  const linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    const href = absoluteUrl(m[1], baseUrl);
    if (!href) continue;
    const title = htmlToText(m[2]) || href;
    const lower = href.toLowerCase();
    const groupMatch = title.match(/групп[аы]?\s*(\d{1,2})/i) || href.match(/(?:^|\/|[_-])(\d{2})(?:[_-]|\.|$)/);
    const group = groupMatch ? String(groupMatch[1]).padStart(2, "0") : null;
    if (/\.pdf(\?|$)/i.test(lower)) {
      pdfs.push({
        title,
        href,
        group,
        kind: /правила|сокращен|символ/i.test(title) ? "rules" : group ? "group-pdf" : "other-pdf",
      });
    } else if (/\.xlsx?(\?|$)/i.test(lower) || /\.xls(\?|$)/i.test(lower)) {
      sheets.push({ title, href, group, kind: "sheet" });
    }
  }
  const urlRe = /https?:\/\/[^\s"'<>]+\.(?:pdf|xlsx|xls)/gi;
  let um;
  while ((um = urlRe.exec(html))) {
    const href = um[0];
    const lower = href.toLowerCase();
    if (/\.pdf/i.test(lower) && !pdfs.some((i) => i.href === href)) {
      pdfs.push({ title: href.split("/").pop(), href, group: null, kind: "other-pdf" });
    }
    if (/\.xlsx?/i.test(lower) && !sheets.some((i) => i.href === href)) {
      sheets.push({ title: href.split("/").pop(), href, group: null, kind: "sheet" });
    }
  }
  return { pdfs, sheets };
}

async function downloadList(items, destDir, label) {
  ensureDir(destDir);
  let n = 0;
  for (const p of items) {
    if (n >= MAX_FILES) break;
    if (!p.href) continue;
    await sleep(DELAY_MS);
    let name;
    try {
      name = (p.group ? `group-${p.group}-` : "") + path.basename(new URL(p.href).pathname);
    } catch {
      name = `${label}-${n}.bin`;
    }
    const dest = path.join(destDir, name);
    try {
      const res = await fetch(p.href, {
        headers: { "User-Agent": "kargo-llm-tnved-corpus/0.1" },
        signal: AbortSignal.timeout(180000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      n++;
      console.log(`[ett] ${label} ${n}/${items.length} ${name} (${buf.length} bytes)`);
    } catch (err) {
      console.warn(`[ett] ${label} fail ${p.href}:`, err.message || err);
    }
  }
  return n;
}

async function main() {
  const stamp = todayStamp();
  const outDir = path.join(TNVED_ROOT, "raw", "eec-ett", stamp);
  ensureDir(outDir);

  console.log(`[ett] fetching ${ETT_URL}`);
  const { text, finalUrl } = await fetchText(ETT_URL);
  fs.writeFileSync(path.join(outDir, "index.html"), text, "utf8");

  const { pdfs, sheets } = parseFileLinks(text, finalUrl || ETT_URL);
  const meta = {
    source: "eec-ett",
    sourceUrl: ETT_URL,
    fetchedAt: new Date().toISOString(),
    finalUrl,
    pdfCount: pdfs.length,
    sheetCount: sheets.length,
    decision: "EEC Council Decision No. 80 (TN VED EAEU + ETT)",
  };
  writeJson(path.join(outDir, "meta.json"), meta);
  writeJson(path.join(outDir, "manifest.json"), { meta, pdfs, sheets });
  console.log(`[ett] pdf=${pdfs.length} sheets=${sheets.length}`);

  let sheetsDownloaded = 0;
  if (sheets.length && DOWNLOAD_SHEETS) {
    sheetsDownloaded = await downloadList(sheets, path.join(outDir, "sheets"), "sheet");
  } else if (sheets.length) {
    console.log("[ett] sheets found — skipped (ETT_DOWNLOAD_SHEETS=0)");
  } else {
    console.log("[ett] no XLSX/XLS links on page (PDF-only publication is normal)");
  }

  let pdfsDownloaded = 0;
  if (DOWNLOAD_PDF) {
    pdfsDownloaded = await downloadList(pdfs, path.join(outDir, "pdfs"), "pdf");
  } else {
    console.log("[ett] skip PDF download (set ETT_DOWNLOAD_PDF=1 to enable)");
  }

  meta.sheetsDownloaded = sheetsDownloaded;
  meta.pdfsDownloaded = pdfsDownloaded;
  writeJson(path.join(outDir, "meta.json"), meta);
  console.log(`[ett] done → ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
