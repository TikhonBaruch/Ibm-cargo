#!/usr/bin/env node
/**
 * Fetch EEC PSN (Пояснения к ТН ВЭД) table of contents + linked group pages.
 * Source: https://eec.eaeunion.org/comission/department/catr/psn/
 *
 * Usage: npm run tnved:fetch-psn
 * Env: PSN_MAX_PAGES (default 120), PSN_DELAY_MS (default 400), PSN_SKIP_PAGES=1
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

const PSN_URL = process.env.PSN_URL || "https://eec.eaeunion.org/comission/department/catr/psn/";
const MAX_PAGES = Number(process.env.PSN_MAX_PAGES || 120);
const DELAY_MS = Number(process.env.PSN_DELAY_MS || 400);
const SKIP_PAGES = process.env.PSN_SKIP_PAGES === "1";

function absoluteUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function parseToc(html, baseUrl) {
  const entries = [];
  let currentVolume = null;
  let currentSection = null;

  // Walk table rows / list-like patterns from EEC page
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = rowRe.exec(html))) {
    const row = m[1];
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => c[1]);
    if (!cells.length) continue;
    const raw0 = htmlToText(cells[0] || "");
    const raw1 = htmlToText(cells[1] || "");
    const linkMatch = row.match(/href=["']([^"']+)["']/i);
    const href = linkMatch ? absoluteUrl(linkMatch[1], baseUrl) : null;

    if (/^TOM\s*[IVX]+/i.test(raw0) || /^ТОМ\s*[IVX\d]+/i.test(raw0)) {
      currentVolume = raw0.replace(/\s+/g, " ").trim();
      entries.push({
        kind: "volume",
        volume: currentVolume,
        title: raw0 || raw1,
        href,
      });
      continue;
    }
    if (/^РАЗДЕЛ\s+/i.test(raw0) || /^Раздел\s+/i.test(raw0)) {
      currentSection = (raw0 + (raw1 ? ` ${raw1}` : "")).trim();
      entries.push({
        kind: "section",
        volume: currentVolume,
        section: currentSection,
        title: currentSection,
        href,
      });
      continue;
    }
    if (/^Группа\s+\d+/i.test(raw0) || /^Group\s+\d+/i.test(raw0)) {
      const gm = raw0.match(/(\d{1,2})/);
      const group = gm ? gm[1].padStart(2, "0") : null;
      entries.push({
        kind: "group",
        volume: currentVolume,
        section: currentSection,
        group,
        title: `${raw0}${raw1 ? ` — ${raw1}` : ""}`.trim(),
        href,
      });
      continue;
    }
    if (raw0 || raw1) {
      entries.push({
        kind: "other",
        volume: currentVolume,
        section: currentSection,
        title: `${raw0}${raw1 ? ` — ${raw1}` : ""}`.trim(),
        href,
      });
    }
  }

  // Fallback: any group links in page
  if (!entries.some((e) => e.kind === "group")) {
    const linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let lm;
    while ((lm = linkRe.exec(html))) {
      const title = htmlToText(lm[2]);
      if (!/группа\s+\d+/i.test(title) && !/group\s+\d+/i.test(title)) continue;
      const gm = title.match(/(\d{1,2})/);
      entries.push({
        kind: "group",
        group: gm ? gm[1].padStart(2, "0") : null,
        title,
        href: absoluteUrl(lm[1], baseUrl),
      });
    }
  }

  return entries;
}

async function main() {
  const stamp = todayStamp();
  const outDir = path.join(TNVED_ROOT, "raw", "eec-psn", stamp);
  const pagesDir = path.join(outDir, "pages");
  ensureDir(pagesDir);

  console.log(`[psn] fetching ${PSN_URL}`);
  const { text, finalUrl } = await fetchText(PSN_URL);
  fs.writeFileSync(path.join(outDir, "index.html"), text, "utf8");

  const toc = parseToc(text, finalUrl || PSN_URL);
  const meta = {
    source: "eec-psn",
    sourceUrl: PSN_URL,
    fetchedAt: new Date().toISOString(),
    finalUrl,
    entryCount: toc.length,
    groupCount: toc.filter((e) => e.kind === "group").length,
  };
  writeJson(path.join(outDir, "meta.json"), meta);
  writeJson(path.join(outDir, "toc.json"), { meta, entries: toc });
  console.log(`[psn] toc entries=${toc.length} groups=${meta.groupCount}`);

  if (SKIP_PAGES) {
    console.log("[psn] PSN_SKIP_PAGES=1 — skipping page fetches");
    return;
  }

  const withHref = toc.filter((e) => e.href);
  // Prefer group pages (full coverage of HS chapters), then sections/volumes
  withHref.sort((a, b) => {
    const rank = (k) => (k === "group" ? 0 : k === "section" ? 1 : k === "volume" ? 2 : 3);
    return rank(a.kind) - rank(b.kind);
  });
  const unique = [];
  const seen = new Set();
  for (const e of withHref) {
    if (seen.has(e.href)) continue;
    seen.add(e.href);
    unique.push(e);
  }

  let fetched = 0;
  for (const e of unique.slice(0, MAX_PAGES)) {
    const safe = (e.group || e.kind || "page") + "-" + Buffer.from(e.href).toString("base64url").slice(0, 24);
    const outFile = path.join(pagesDir, `${safe}.json`);
    try {
      await sleep(DELAY_MS);
      const page = await fetchText(e.href);
      const payload = {
        ...e,
        fetchedAt: new Date().toISOString(),
        sourceUrl: e.href,
        contentType: page.contentType,
        text: htmlToText(page.text).slice(0, 200000),
        htmlBytes: Buffer.byteLength(page.text, "utf8"),
      };
      writeJson(outFile, payload);
      fetched++;
      console.log(`[psn] page ${fetched}/${Math.min(unique.length, MAX_PAGES)} ${e.title?.slice(0, 60)}`);
    } catch (err) {
      console.warn(`[psn] fail ${e.href}:`, err.message || err);
      writeJson(outFile.replace(/\.json$/, ".error.json"), {
        ...e,
        error: String(err.message || err),
        fetchedAt: new Date().toISOString(),
      });
    }
  }
  console.log(`[psn] done → ${outDir} (pages fetched=${fetched})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
