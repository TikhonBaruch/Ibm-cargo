#!/usr/bin/env node
/**
 * Probe data.egov.kz ETT dataset for machine-readable stavka (v4).
 * v3 historically is link-only to EEC PDFs.
 *
 * Usage: npm run tnved:fetch-kz
 */
import fs from "node:fs";
import path from "node:path";
import { TNVED_ROOT, todayStamp, ensureDir, writeJson, fetchText } from "./tnved-lib.mjs";

const DATASET = process.env.KZ_ETT_DATASET || "euraziyalyk_ekonomikalyk_odakt";
const SEEDS = [
  `https://data.egov.kz/datasets/view?index=${DATASET}`,
  `https://data.egov.kz/api/v4/${DATASET}`,
  `https://data.egov.kz/api/v4/${DATASET}/data`,
  `https://data.egov.kz/api/3/action/package_show?id=${DATASET}`,
];

function looksLikeRates(text) {
  const sample = text.slice(0, 8000);
  return /"stavka"|"dutyPct"|"kod"|тн.?вэд/i.test(sample) && !/"link"\s*:\s*"https:\/\/eec/.test(sample);
}

async function main() {
  const stamp = todayStamp();
  const outDir = path.join(TNVED_ROOT, "raw", "kz-ett", stamp);
  ensureDir(outDir);
  const attempts = [];
  for (const url of SEEDS) {
    try {
      const { text, contentType, finalUrl } = await fetchText(url, {
        accept: "application/json,text/html,*/*",
        timeoutMs: 30000,
      });
      const dest = path.join(outDir, Buffer.from(url).toString("base64url").slice(0, 40) + ".txt");
      fs.writeFileSync(dest, text.slice(0, 200_000), "utf8");
      attempts.push({
        url,
        finalUrl,
        contentType,
        ok: true,
        bytes: text.length,
        maybeRates: looksLikeRates(text),
      });
      console.log(`[kz] ok ${url} ${text.length}b rates? ${looksLikeRates(text)}`);
    } catch (err) {
      attempts.push({ url, ok: false, error: String(err.message || err) });
      console.warn(`[kz] fail ${url}:`, err.message || err);
    }
  }
  const meta = {
    source: "kz-egov-ett",
    dataset: DATASET,
    fetchedAt: new Date().toISOString(),
    attempts,
    gap: attempts.some((a) => a.maybeRates)
      ? null
      : "No machine-readable stavka in probed v3/v4 URLs (likely still PDF links).",
  };
  writeJson(path.join(outDir, "meta.json"), meta);
  console.log(`[kz] done → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
