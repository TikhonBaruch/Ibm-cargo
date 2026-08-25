#!/usr/bin/env node
/**
 * Extract text from EEC PSN PDFs listed in raw/eec-psn toc.json (+ optional volume VI).
 * Uses pdftotext. Writes pages/*.json with body text (not raw PDF bytes).
 *
 * Usage: npm run tnved:parse-psn
 * Env: PSN_DIR (override latest), PSN_MAX_PDFS (default 120), PSN_DELAY_MS (default 300)
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  TNVED_ROOT,
  ensureDir,
  writeJson,
  fetchText,
  sleep,
  htmlToText,
  todayStamp,
} from "./tnved-lib.mjs";

const MAX = Number(process.env.PSN_MAX_PDFS || 200);
const DELAY_MS = Number(process.env.PSN_DELAY_MS || 300);
const DOP_URL = process.env.PSN_DOP_URL || "https://eec.eaeunion.org/comission/department/catr/psn/doppsn.php";

function latestPsnDir() {
  if (process.env.PSN_DIR) return process.env.PSN_DIR;
  const root = path.join(TNVED_ROOT, "raw", "eec-psn");
  if (!fs.existsSync(root)) return null;
  const dirs = fs
    .readdirSync(root)
    .filter((d) => fs.statSync(path.join(root, d)).isDirectory())
    .sort()
    .reverse();
  return dirs[0] ? path.join(root, dirs[0]) : null;
}

function pdfToText(buf) {
  const tmpPdf = path.join("/tmp", `psn-${process.pid}-${Date.now()}.pdf`);
  const tmpTxt = tmpPdf.replace(/\.pdf$/, ".txt");
  try {
    fs.writeFileSync(tmpPdf, buf);
    const r = spawnSync("pdftotext", ["-layout", "-enc", "UTF-8", tmpPdf, tmpTxt], {
      encoding: "utf8",
      timeout: 120_000,
    });
    if (r.status !== 0) {
      throw new Error(r.stderr || `pdftotext exit ${r.status}`);
    }
    return fs.readFileSync(tmpTxt, "utf8");
  } finally {
    try {
      fs.unlinkSync(tmpPdf);
    } catch {
      /* ignore */
    }
    try {
      fs.unlinkSync(tmpTxt);
    } catch {
      /* ignore */
    }
  }
}

async function downloadPdf(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "kargo-llm-tnved-corpus/0.1", Accept: "application/pdf,*/*" },
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function parseDopToc(html, baseUrl) {
  const entries = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  let section = null;
  while ((m = rowRe.exec(html))) {
    const row = m[1];
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => htmlToText(c[1]));
    const linkMatch = row.match(/href=["']([^"']+)["']/i);
    const href = linkMatch ? new URL(linkMatch[1], baseUrl).href : null;
    const raw0 = cells[0] || "";
    const raw1 = cells[1] || "";
    if (/^РАЗДЕЛ\s+/i.test(raw0)) {
      section = `${raw0} ${raw1}`.trim();
      continue;
    }
    if (/^Группа\s+\d+/i.test(raw0)) {
      const gm = raw0.match(/(\d{1,2})/);
      entries.push({
        kind: "group",
        volume: "ТОМ VI",
        section,
        group: gm ? gm[1].padStart(2, "0") : null,
        title: `${raw0}${raw1 ? ` — ${raw1}` : ""}`.trim(),
        href,
      });
    }
  }
  return entries;
}

async function main() {
  let outDir = latestPsnDir();
  if (!outDir) {
    outDir = path.join(TNVED_ROOT, "raw", "eec-psn", todayStamp());
    ensureDir(outDir);
  }
  const pagesDir = path.join(outDir, "pages");
  const pdfDir = path.join(outDir, "pdfs");
  ensureDir(pagesDir);
  ensureDir(pdfDir);

  const tocPath = path.join(outDir, "toc.json");
  let toc = fs.existsSync(tocPath) ? JSON.parse(fs.readFileSync(tocPath, "utf8")) : { meta: {}, entries: [] };

  // Merge том VI index (HTML links may point to PDF or empty)
  try {
    console.log(`[parse-psn] fetching ${DOP_URL}`);
    const dop = await fetchText(DOP_URL);
    const dopEntries = parseDopToc(dop.text, dop.finalUrl || DOP_URL);
    writeJson(path.join(outDir, "toc-tom6.json"), {
      meta: { source: "eec-psn-tom6", sourceUrl: DOP_URL, fetchedAt: new Date().toISOString() },
      entries: dopEntries,
    });
    const existing = new Set((toc.entries || []).map((e) => `${e.volume}|${e.group}|${e.href}`));
    for (const e of dopEntries) {
      const key = `${e.volume}|${e.group}|${e.href}`;
      if (!existing.has(key)) toc.entries.push(e);
    }
    writeJson(tocPath, toc);
    console.log(`[parse-psn] tom6 groups=${dopEntries.length}`);
  } catch (err) {
    console.warn("[parse-psn] tom6 skip:", err.message || err);
  }

  const pdfEntries = (toc.entries || []).filter((e) => e.href && /\.pdf(\?|$)/i.test(e.href));
  const unique = [];
  const seen = new Set();
  for (const e of pdfEntries) {
    if (seen.has(e.href)) continue;
    seen.add(e.href);
    unique.push(e);
  }

  let ok = 0;
  let fail = 0;
  for (const e of unique.slice(0, MAX)) {
    const safe = `${e.group || e.kind || "doc"}-${Buffer.from(e.href).toString("base64url").slice(0, 24)}`;
    const pdfPath = path.join(pdfDir, `${safe}.pdf`);
    const outFile = path.join(pagesDir, `${safe}.json`);
    try {
      await sleep(DELAY_MS);
      const buf = await downloadPdf(e.href);
      fs.writeFileSync(pdfPath, buf);
      const text = pdfToText(buf).slice(0, 500_000);
      if (!text.trim() || text.startsWith("%PDF")) {
        throw new Error("empty or binary text extract");
      }
      writeJson(outFile, {
        ...e,
        fetchedAt: new Date().toISOString(),
        sourceUrl: e.href,
        contentType: "application/pdf",
        text,
        pdfBytes: buf.length,
        extract: "pdftotext",
      });
      ok++;
      console.log(`[parse-psn] ${ok}/${Math.min(unique.length, MAX)} ${e.title?.slice(0, 50) || e.href}`);
    } catch (err) {
      fail++;
      console.warn(`[parse-psn] fail ${e.href}:`, err.message || err);
      writeJson(outFile.replace(/\.json$/, ".error.json"), {
        ...e,
        error: String(err.message || err),
        at: new Date().toISOString(),
      });
    }
  }

  writeJson(path.join(outDir, "parse-meta.json"), {
    parsedAt: new Date().toISOString(),
    ok,
    fail,
    pdfCandidates: unique.length,
  });
  console.log(`[parse-psn] done ok=${ok} fail=${fail} → ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
