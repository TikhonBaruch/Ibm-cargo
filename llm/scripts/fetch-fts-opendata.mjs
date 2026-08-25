#!/usr/bin/env node
/**
 * Probe FTS (Federal Customs Service) open-data catalogs for TN VED / duty datasets.
 *
 * Usage: npm run tnved:fetch-fts
 * Env: FTS_DATASET_URL — direct CSV/JSON/XML/ZIP URL to download into datasets/
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

const DIRECT = process.env.FTS_DATASET_URL || "";
const KEYWORDS =
  /тн\s*вэд|tnved|товарн\w*\s+номенклатур|единый\s+таможенный\s+тариф|\bетт\b|ставк\w*\s+пошлин|\bакциз(?:ы|а|ов|н(?:ый|ая|ое|ые|ых))?(?:\s|$|,|;|:)|преференц/i;
const LOOSE = /ставк\w*\s+пошлин|ввозн\w*\s+пошлин|ндс\s+при\s+ввоз|тарифн\w*\s+льгот/i;

const SEEDS = [
  DIRECT,
  "https://customs.gov.ru/opendata/list.csv",
  "https://customs.gov.ru/opendata",
  "https://data.customs.gov.ru/",
  "https://data.customs.ru/",
  "https://customs.gov.ru/",
  "https://edata.customs.ru/",
  "https://tnved.customs.ru/",
].filter(Boolean);

function absoluteUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function harvest(html, base) {
  const items = [];
  const linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    const href = absoluteUrl(m[1], base);
    const title = htmlToText(m[2]);
    if (!href) continue;
    const blob = `${title} ${href}`;
    if (!KEYWORDS.test(blob) && !LOOSE.test(blob) && !/\.(csv|xml|json|zip|xlsx)(\?|$)/i.test(href)) continue;
    items.push({
      title: title || href,
      href,
      score: (KEYWORDS.test(blob) ? 10 : 0) + (LOOSE.test(blob) ? 3 : 0) + (/\.(csv|xml|json|zip)(\?|$)/i.test(href) ? 2 : 0),
    });
  }
  return items.sort((a, b) => b.score - a.score);
}

async function downloadDataset(url, destDir, nameHint) {
  const res = await fetch(url, {
    headers: { "User-Agent": "kargo-llm-tnved-corpus/0.1" },
    signal: AbortSignal.timeout(180000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  const buf = Buffer.from(await res.arrayBuffer());
  let ext = "bin";
  if (/json/i.test(ct) || url.match(/\.json(\?|$)/i)) ext = "json";
  else if (/xml/i.test(ct) || url.match(/\.xml(\?|$)/i)) ext = "xml";
  else if (/csv|text\/plain|text\/csv/i.test(ct) || url.match(/\.csv(\?|$)/i)) ext = "csv";
  else if (/zip/i.test(ct) || url.match(/\.zip(\?|$)/i) || (buf[0] === 0x50 && buf[1] === 0x4b)) ext = "zip";
  else if (/html/i.test(ct)) {
    throw new Error("HTML response");
  }
  let base = nameHint || "dataset";
  try {
    base = path.basename(new URL(url).pathname).replace(/\.[^.]+$/, "") || base;
  } catch {
    /* keep hint */
  }
  const name = String(base || "dataset").replace(/\W+/g, "_").slice(0, 60) + "." + ext;
  const file = path.join(destDir, name);
  fs.writeFileSync(file, buf);
  return { file: name, bytes: buf.length, contentType: ct };
}

async function main() {
  const stamp = todayStamp();
  const outDir = path.join(TNVED_ROOT, "raw", "fts-opendata", stamp);
  const dsDir = path.join(outDir, "datasets");
  ensureDir(dsDir);

  const attempts = [];
  const catalog = [];
  let downloaded = [];

  if (DIRECT) {
    try {
      console.log(`[fts] direct ${DIRECT}`);
      const d = await downloadDataset(DIRECT, dsDir, "direct");
      downloaded.push({ url: DIRECT, ...d });
      attempts.push({ url: DIRECT, ok: true, downloaded: d });
    } catch (err) {
      attempts.push({ url: DIRECT, ok: false, error: String(err.message || err) });
    }
  }

  for (const url of SEEDS.filter((u) => u !== DIRECT)) {
    try {
      console.log(`[fts] probe ${url}`);
      await sleep(250);
      const { text, finalUrl, contentType } = await fetchText(url, { timeoutMs: 40000 });
      let items = harvest(text, finalUrl || url);

      // Official FTS open-data registry CSV
      if (/list\.csv/i.test(url) || /^property,title,value/i.test(text.slice(0, 80))) {
        const lines = text.split(/\r?\n/).slice(1);
        for (const line of lines) {
          if (!line.trim()) continue;
          // id,"title",url,format
          const m = line.match(/^([^,]+),"(.*)",(https?:\/\/[^,]+),([^,]*)$/);
          const m2 = !m ? line.match(/^([^,]+),([^,]*),(https?:\/\/[^,]+),?(.*)$/) : null;
          const title = (m ? m[2] : m2 ? m2[2].replace(/^"|"$/g, "") : "").trim();
          const href = (m ? m[3] : m2 ? m2[3] : "").trim();
          if (!href) continue;
          const score = KEYWORDS.test(title + " " + href) ? 12 : LOOSE.test(title) ? 4 : 1;
          items.push({ title: title || href, href, score, fromListCsv: true });
        }
        // save registry snapshot
        fs.writeFileSync(path.join(outDir, "list.csv"), text, "utf8");
      }

      items = items.sort((a, b) => b.score - a.score);
      const catalogSlice = items.filter((x) => x.score >= 4 || KEYWORDS.test(`${x.title} ${x.href}`));
      attempts.push({
        url,
        finalUrl,
        contentType,
        ok: true,
        bytes: Buffer.byteLength(text, "utf8"),
        hits: items.length,
        catalogHits: catalogSlice.length,
      });
      for (const it of (catalogSlice.length ? catalogSlice : items.slice(0, 15))) catalog.push(it);

      const safe = Buffer.from(url).toString("base64url").slice(0, 16);
      if (/html/i.test(contentType) || /<html/i.test(text.slice(0, 200))) {
        fs.writeFileSync(path.join(outDir, `probe-${safe}.html`), text.slice(0, 300000), "utf8");
      }

      // Only download TN VED / duty keyword hits (or FTS_DATASET_URL above)
      const toFetch = items.filter((x) => x.score >= 8).slice(0, 5);
      const seenFetch = new Set();
      for (const it of toFetch) {
        if (seenFetch.has(it.href)) continue;
        seenFetch.add(it.href);
        try {
          await sleep(300);
          const d = await downloadDataset(it.href, dsDir, it.title);
          downloaded.push({ url: it.href, title: it.title, ...d });
          console.log(`[fts] downloaded ${d.file} (${d.bytes})`);
        } catch (e) {
          attempts.push({ url: it.href, ok: false, error: String(e.message || e) });
        }
      }
    } catch (err) {
      attempts.push({ url, ok: false, error: String(err.message || err) });
      console.warn(`[fts] fail ${url}:`, err.message || err);
    }
  }

  // dedupe catalog by href
  const seen = new Set();
  const catalogUniq = [];
  for (const c of catalog.sort((a, b) => b.score - a.score)) {
    if (seen.has(c.href)) continue;
    seen.add(c.href);
    catalogUniq.push(c);
  }

  const tnvedHits = catalogUniq.filter((c) => KEYWORDS.test(`${c.title} ${c.href}`));
  const meta = {
    source: "fts-opendata",
    fetchedAt: new Date().toISOString(),
    downloaded: downloaded.length,
    catalogSize: catalogUniq.length,
    tnvedKeywordHits: tnvedHits.length,
    status: "ok",
    gap:
      tnvedHits.length === 0
        ? "FTS open-data list.csv has no TN VED/ETT duty classifier dataset (registries & vacancies dominate). Codes/rates remain EEC NSI/ETT; set FTS_DATASET_URL for overlays."
        : null,
    dropIn: `data/tnved/raw/fts-opendata/${stamp}/datasets/`,
    attempts,
  };
  writeJson(path.join(outDir, "meta.json"), meta);
  writeJson(path.join(outDir, "catalog.json"), { meta, items: catalogUniq.slice(0, 100) });
  console.log(`[fts] done catalog=${catalogUniq.length} downloaded=${downloaded.length} → ${outDir}`);
  if (meta.gap) console.warn(`[fts] GAP: ${meta.gap}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
