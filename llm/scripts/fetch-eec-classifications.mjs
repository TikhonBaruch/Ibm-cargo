#!/usr/bin/env node
/**
 * Official EEC classification rulings index (not TKS scrape).
 * Source: dep_tamoj_zak / resheniya-o-klassifikatsii-tovarov.php
 *
 * Usage: npm run tnved:fetch-classifications
 */
import fs from "node:fs";
import path from "node:path";
import {
  TNVED_ROOT,
  todayStamp,
  ensureDir,
  writeJson,
  fetchText,
  htmlToText,
} from "./tnved-lib.mjs";

const PAGE_URL =
  process.env.EEC_CLASSIFICATIONS_URL ||
  "https://eec.eaeunion.org/comission/department/dep_tamoj_zak/klassifikatsiya-tovarov-v-sootvetstvii-s-tn-ved-eaes/resheniya-o-klassifikatsii-tovarov.php";

function absoluteUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function harvest(html, baseUrl) {
  const pdfs = [];
  const links = [];
  const linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    const href = absoluteUrl(m[1], baseUrl);
    if (!href) continue;
    const title = htmlToText(m[2]) || href;
    links.push({ title, href });
    if (/\.pdf(\?|$)/i.test(href)) pdfs.push({ title, href });
  }
  return { links, pdfs };
}

async function main() {
  const stamp = todayStamp();
  const outDir = path.join(TNVED_ROOT, "raw", "eec-classifications", stamp);
  ensureDir(outDir);
  console.log(`[classifications] fetching ${PAGE_URL}`);
  const { text, finalUrl } = await fetchText(PAGE_URL);
  fs.writeFileSync(path.join(outDir, "index.html"), text, "utf8");
  const { links, pdfs } = harvest(text, finalUrl || PAGE_URL);
  const meta = {
    source: "eec-classifications",
    sourceUrl: PAGE_URL,
    fetchedAt: new Date().toISOString(),
    finalUrl,
    linkCount: links.length,
    pdfCount: pdfs.length,
    note: "Index only. Join 10-digit codes is a follow-up. Not TKS predecision.",
  };
  writeJson(path.join(outDir, "meta.json"), meta);
  writeJson(path.join(outDir, "manifest.json"), { meta, pdfs, links: links.slice(0, 500) });
  console.log(`[classifications] links=${links.length} pdfs=${pdfs.length} → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
