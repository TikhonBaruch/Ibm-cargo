#!/usr/bin/env node
/**
 * Discover + download EAEU NSI СТНВЭДСТ (catalog 043) via opendata/nsi portals.
 * Replaces best-effort probe with OData/link discovery + NSI_XML_URL / drop-in.
 *
 * Usage: npm run tnved:fetch-nsi
 * Env: NSI_XML_URL — direct file URL; NSI_SEARCH_QUERY (default СТНВЭДСТ)
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
} from "./tnved-lib.mjs";

const SEARCH = process.env.NSI_SEARCH_QUERY || "СТНВЭДСТ";
const DIRECT = process.env.NSI_XML_URL || "";

const SEEDS = [
  DIRECT,
  "https://opendata.eaeunion.org/",
  "https://opendata.eaeunion.org/opendata/ru/api/apiodata",
  "https://nsi.eaeunion.org/portal?registryType=dictionary",
  "https://nsi.eaeunion.org/portal/1994/",
  // common OData-style probes (may 404)
  "https://opendata.eaeunion.org/odata/$metadata",
  "http://opendata.eaeunion.org/odata/$metadata",
  "https://opendata.eaeunion.org/odata/",
  "https://portal.eaeunion.org/sites/odata/_api/",
].filter(Boolean);

function absoluteUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function harvestLinks(html, base) {
  const out = [];
  const re = /href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = absoluteUrl(m[1], base);
    if (u) out.push(u);
  }
  const urlRe = /https?:\/\/[^\s"'<>]+/gi;
  let um;
  while ((um = urlRe.exec(html))) out.push(um[0].replace(/[),.;]+$/, ""));
  return [...new Set(out)];
}

function scoreLink(url) {
  const u = url.toLowerCase();
  if (/oasis-open\.org|w3\.org\/|schema\.org|googleapis|facebook|twitter|vk\.com/.test(u)) return 0;
  let s = 0;
  if (/стнвэд|stnved|043|tnved|тн.?вэд|ett/.test(u)) s += 5;
  try {
    if (/стнвэд|stnved|tnved|тн.?вэд/.test(decodeURIComponent(u))) s += 8;
  } catch {
    /* ignore */
  }
  if (/\.(xml|json|zip)(\?|$)/i.test(u)) s += 10;
  if (/download|export|файл|выгруз/.test(u)) s += 4;
  if (/eaeunion\.org.*(odata|\$metadata|dictionary|nsi|opendata)/.test(u)) s += 2;
  if (/passport|паспорт/.test(u)) s += 1;
  return s;
}

async function tryDownload(url, outDir) {
  const { text, contentType, finalUrl } = await fetchText(url, {
    accept: "application/xml,application/json,application/zip,*/*",
    timeoutMs: 120000,
  });
  const looksXml = /xml/i.test(contentType) || text.trimStart().startsWith("<?xml") || text.trimStart().startsWith("<");
  const looksJson =
    /json/i.test(contentType) || text.trimStart().startsWith("{") || text.trimStart().startsWith("[");
  const looksZip = /zip|octet-stream/i.test(contentType) || url.toLowerCase().endsWith(".zip");

  if (looksZip || (text.length > 4 && text.charCodeAt(0) === 0x50 && text.charCodeAt(1) === 0x4b)) {
    // binary zip — re-fetch as arrayBuffer
    const res = await fetch(url, {
      headers: { "User-Agent": "kargo-llm-tnved-corpus/0.1" },
      signal: AbortSignal.timeout(300000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const file = path.join(outDir, "catalog.zip");
    fs.writeFileSync(file, buf);
    return { file: path.basename(file), contentType, finalUrl, bytes: buf.length };
  }

  if (looksXml || looksJson) {
    // Heuristic: large structured payload, not an HTML shell
    const isHtml = /<html[\s>]/i.test(text) && text.length < 500000 && !looksXml;
    if (isHtml && !DIRECT) throw new Error("HTML page, not catalog");
    const ext = looksJson && !looksXml ? "json" : "xml";
    // Prefer xml if both ambiguous and starts with <
    const useExt = text.trimStart().startsWith("{") || text.trimStart().startsWith("[") ? "json" : ext;
    const file = path.join(outDir, `catalog.${useExt === "json" ? "json" : "xml"}`);
    fs.writeFileSync(file, text, "utf8");
    return { file: path.basename(file), contentType, finalUrl, bytes: Buffer.byteLength(text) };
  }
  throw new Error(`unsupported content-type ${contentType}`);
}

async function main() {
  const stamp = todayStamp();
  const outDir = path.join(TNVED_ROOT, "raw", "nsi-stnvedst", stamp);
  ensureDir(outDir);

  const attempts = [];
  const candidateLinks = [];
  let saved = null;

  // Direct URL first
  if (DIRECT) {
    try {
      console.log(`[nsi] direct ${DIRECT}`);
      saved = await tryDownload(DIRECT, outDir);
      attempts.push({ url: DIRECT, ok: true, saved });
    } catch (err) {
      attempts.push({ url: DIRECT, ok: false, error: String(err.message || err) });
      console.warn("[nsi] direct fail:", err.message || err);
    }
  }

  for (const url of SEEDS.filter((u) => u !== DIRECT)) {
    try {
      console.log(`[nsi] probe ${url}`);
      await sleep(200);
      const { text, finalUrl, contentType } = await fetchText(url, {
        accept: "application/xml,application/json,text/html,*/*",
        timeoutMs: 45000,
      });
      const links = harvestLinks(text, finalUrl || url)
        .map((l) => ({ url: l, score: scoreLink(l) }))
        .filter((l) => l.score > 0)
        .sort((a, b) => b.score - a.score);
      attempts.push({
        url,
        finalUrl,
        contentType,
        ok: true,
        bytes: Buffer.byteLength(text, "utf8"),
        topLinks: links.slice(0, 15),
      });
      for (const l of links.slice(0, 25)) candidateLinks.push(l.url);

      // Save HTML probe for manual review
      const safe = Buffer.from(url).toString("base64url").slice(0, 16);
      if (/html/i.test(contentType) || /<html/i.test(text.slice(0, 200))) {
        fs.writeFileSync(path.join(outDir, `probe-${safe}.html`), text.slice(0, 400000), "utf8");
      }

      // Try downloading high-score file links
      if (!saved) {
        for (const l of links.slice(0, 8)) {
          if (l.score < 8) continue;
          try {
            await sleep(300);
            console.log(`[nsi] try download score=${l.score} ${l.url}`);
            saved = await tryDownload(l.url, outDir);
            attempts.push({ url: l.url, ok: true, saved });
            break;
          } catch (e) {
            attempts.push({ url: l.url, ok: false, error: String(e.message || e) });
          }
        }
      }
    } catch (err) {
      attempts.push({ url, ok: false, error: String(err.message || err) });
      console.warn(`[nsi] fail ${url}:`, err.message || err);
    }
  }

  const uniqCandidates = [...new Set(candidateLinks)].slice(0, 60);
  const meta = {
    source: "eec-nsi",
    catalogCode: "043",
    abbreviation: "СТНВЭДСТ",
    search: SEARCH,
    decision: "EEC Board Decision No. 113 (2023-08-15)",
    fetchedAt: new Date().toISOString(),
    savedArtifact: saved?.file || null,
    candidateLinks: uniqCandidates,
    gap: saved
      ? null
      : "СТНВЭДСТ XML/JSON not auto-downloaded. Open nsi/opendata, download the formal catalog, place as catalog.xml in this folder, or set NSI_XML_URL.",
    dropIn: `data/tnved/raw/nsi-stnvedst/${stamp}/catalog.xml`,
    attempts,
  };
  writeJson(path.join(outDir, "meta.json"), meta);
  console.log(`[nsi] done → ${outDir}`);
  if (meta.gap) console.warn(`[nsi] GAP: ${meta.gap}`);
  else console.log(`[nsi] saved ${saved.file} (${saved.bytes} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
