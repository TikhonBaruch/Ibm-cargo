#!/usr/bin/env ts-node
/**
 * Glue FNS tree + EEC PSN excerpts + RF payments + layer-G triggers + TWS duty fill.
 * Writes gitignored normalized/summary.json and patches group notes from PSN.
 * Usage: npm run tnved:compose
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { overlayTwsDuties, type TwsCorpusDuty } from "../src/lib/ved/tnved-tws";

const root = path.resolve(__dirname, "..");
const jsonlPath = path.join(root, "scripts/data/tnved/normalized/codes.jsonl");
const summaryPath = path.join(root, "scripts/data/tnved/normalized/summary.json");
const psnPath =
  process.env.PSN_NOTES ||
  path.join(root, "scripts/data/tnved/normalized/notes.jsonl");

type OverlayFile = {
  rules: Array<{ flag: string; prefixes: string[] }>;
};

function matchLayerG(code: string) {
  const overlay = JSON.parse(
    readFileSync(path.join(root, "src/lib/ved/tnved-layer-g.json"), "utf8")
  ) as OverlayFile;
  const digits = String(code || "").replace(/\D/g, "");
  const hits: Array<{ flag: string }> = [];
  const seen = new Set<string>();
  for (const rule of overlay.rules) {
    if (seen.has(rule.flag)) continue;
    const prefixes = [...rule.prefixes].sort((a, b) => b.length - a.length);
    if (!prefixes.some((p) => digits.startsWith(p))) continue;
    seen.add(rule.flag);
    hits.push({ flag: rule.flag });
  }
  return hits;
}

type Node = {
  code: string;
  level: number;
  isLeaf?: boolean;
  notes?: string | null;
  titleRu?: string;
  rate?: {
    code: string;
    dutyKind: "AD_VALOREM" | "SPECIFIC" | "COMBINED";
    dutyPct: number | null;
    vatPct?: number | null;
    unit?: string | null;
    source?: string | null;
  };
};

function loadJsonl(p: string): Node[] {
  return readFileSync(p, "utf8")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Node);
}

function psnByGroup(p: string): Map<string, { heading: string; excerpt: string; url: string | null }> {
  const map = new Map<string, { heading: string; excerpt: string; url: string | null }>();
  if (!existsSync(p)) return map;
  for (const line of readFileSync(p, "utf8").split(/\n/)) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as {
      kind?: string;
      anchorCode?: string | null;
      heading?: string;
      body?: string | null;
      sourceUrl?: string | null;
    };
    const code = String(row.anchorCode || "").replace(/\D/g, "");
    if (code.length !== 2) continue;
    const body = String(row.body || "").replace(/\s+/g, " ").trim();
    if (!body) continue;
    const prev = map.get(code);
    if (prev && prev.excerpt.length >= 800) continue;
    map.set(code, {
      heading: String(row.heading || `Группа ${code}`),
      excerpt: body.slice(0, 1200),
      url: row.sourceUrl || null,
    });
  }
  return map;
}

function main() {
  if (!existsSync(jsonlPath)) {
    throw new Error(`Missing ${jsonlPath}. Run npm run tnved:normalize`);
  }
  const nodes = loadJsonl(jsonlPath);
  const psn = psnByGroup(psnPath);
  let psnAttached = 0;
  const withPsn = nodes.map((n) => {
    if (n.level === 2 && psn.has(n.code)) {
      const hit = psn.get(n.code)!;
      psnAttached += 1;
      return {
        ...n,
        notes: `ЕЭК PSN: ${hit.heading}. ${hit.excerpt}`.slice(0, 4000),
      };
    }
    return n;
  });
  const twsPath =
    process.env.TWS_CODES_JSONL ||
    path.join(root, "scripts/data/tnved/normalized/codes.jsonl");
  const twsCorpus: TwsCorpusDuty[] = existsSync(twsPath)
    ? (loadJsonl(twsPath) as unknown as TwsCorpusDuty[])
    : [];
  const { nodes: out, overlayed, withPct } = overlayTwsDuties(withPsn, twsCorpus);
  writeFileSync(jsonlPath, out.map((n) => JSON.stringify(n)).join("\n") + "\n");

  const leaves = nodes.filter((n) => n.isLeaf);
  let excise = 0;
  let util = 0;
  let eco = 0;
  let ntm = 0;
  for (const leaf of leaves) {
    const hits = matchLayerG(leaf.code);
    if (hits.some((h) => h.flag === "excisePossible")) excise += 1;
    if (hits.some((h) => h.flag === "utilSborPossible")) util += 1;
    if (hits.some((h) => h.flag === "ecoFeePossible")) eco += 1;
    if (hits.some((h) => h.flag === "ntmPossible")) ntm += 1;
  }
  const summary = {
    composedAt: new Date().toISOString(),
    source: "fns-tnved4 + eec-psn + RF payments + layer-G + tws-csv duty fill",
    nodes: nodes.length,
    leaves: leaves.length,
    psnGroupsWithText: psn.size,
    psnNotesAttached: psnAttached,
    layerG: {
      excisePossibleLeaves: excise,
      utilSborPossibleLeaves: util,
      ecoFeePossibleLeaves: eco,
      ntmPossibleLeaves: ntm,
    },
    payments: { vatPct: 22, feeRule: "ПП 1637" },
    tws: {
      path: existsSync(twsPath) ? twsPath : null,
      overlayed,
      withPct,
    },
    ettRates: withPct > 0 ? `tws-csv fill ${withPct} leaves (not NSI STNVEDST)` : null,
    psnNotesPath: psnPath,
  };
  mkdirSync(path.dirname(summaryPath), { recursive: true });
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
}

main();
