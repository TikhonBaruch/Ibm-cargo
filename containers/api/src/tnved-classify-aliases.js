/**
 * Mirror of src/lib/ved/tnved-classify-aliases.ts — lab + invoice aliases for cascade.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadJsonCandidates(names, fallback) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const roots = [
    here,
    path.join(here, "../../../src/lib/ved"),
    path.join(here, "../../../src/lbm-bro/lib"),
  ];
  for (const name of names) {
    for (const root of roots) {
      try {
        return JSON.parse(readFileSync(path.join(root, name), "utf8"));
      } catch {
        /* try next */
      }
    }
  }
  return fallback;
}

const labAliases = loadJsonCandidates(["hs-aliases.json"], []);
const invoiceAliases = loadJsonCandidates(["tnved-invoice-aliases.json"], []);

function digits(v) {
  return String(v || "").replace(/\D/g, "");
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeClassifyQuery(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[-_/\\,.;:()[\]{}+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wholeWord(query, key) {
  return new RegExp(`(?:^|[^a-zа-я0-9])${escapeRe(key)}(?:$|[^a-zа-я0-9])`, "i").test(query);
}

function excludeHits(query, raw) {
  const whole = raw.startsWith("=");
  const key = normalizeClassifyQuery(whole ? raw.slice(1) : raw);
  if (!key) return false;
  return wholeWord(query, key);
}

function keyHits(query, raw) {
  const whole = raw.startsWith("=");
  const key = normalizeClassifyQuery(whole ? raw.slice(1) : raw);
  if (!key) return false;
  if (whole || key.length <= 3) return wholeWord(query, key);
  return query.includes(key);
}

function mergeAliasLists() {
  const byCode = new Map();
  for (const row of labAliases) {
    const code = digits(row.code);
    if (!code) continue;
    const prev = byCode.get(code);
    if (prev) {
      byCode.set(code, {
        code,
        keys: [...new Set([...prev.keys, ...(row.keys || [])])],
        exclude: [...new Set([...(prev.exclude || []), ...(row.exclude || [])])],
        why: prev.why.length >= String(row.why || "").length ? prev.why : row.why,
        risk: prev.risk || row.risk || "Уточните описание товара",
      });
    } else {
      byCode.set(code, {
        code,
        keys: [...(row.keys || [])],
        exclude: row.exclude ? [...row.exclude] : undefined,
        why: row.why,
        risk: row.risk || "Уточните описание товара",
      });
    }
  }
  for (const row of invoiceAliases) {
    const code = digits(row.code);
    if (!code) continue;
    const existing = byCode.get(code);
    if (existing) {
      byCode.set(code, {
        ...existing,
        keys: [...new Set([...existing.keys, ...(row.keys || [])])],
        why: existing.why || row.why || existing.why,
      });
    } else {
      byCode.set(code, {
        code,
        keys: [...(row.keys || [])],
        why: row.why || "Сопоставление по строке инвойса.",
        risk: "Уточните описание товара",
      });
    }
  }
  return [...byCode.values()];
}

export const CLASSIFY_ALIASES = mergeAliasLists();

export function scoreClassifyAlias(query, alias) {
  if (alias.exclude?.some((k) => excludeHits(query, k))) return 0;
  let score = 0;
  for (const k of alias.keys) {
    if (!keyHits(query, k)) continue;
    const len = normalizeClassifyQuery(k.startsWith("=") ? k.slice(1) : k).length;
    score += 10 + len * 4;
    if (len >= 10) score += 8;
  }
  return score;
}

export function matchClassifyAlias(query, minScore = 14) {
  const q = normalizeClassifyQuery(query);
  if (!q) return null;
  let best = null;
  let bestScore = 0;
  for (const alias of CLASSIFY_ALIASES) {
    const s = scoreClassifyAlias(q, alias);
    if (s > bestScore) {
      best = alias;
      bestScore = s;
    }
  }
  if (!best || bestScore < minScore) return null;
  return { alias: best, score: bestScore };
}

export function classifyAliasByCode(code) {
  const d = digits(code);
  const exact = CLASSIFY_ALIASES.find((a) => a.code === d);
  if (exact) return exact;
  if (d.length === 9) return CLASSIFY_ALIASES.find((a) => a.code === `${d}0`) || null;
  return null;
}
