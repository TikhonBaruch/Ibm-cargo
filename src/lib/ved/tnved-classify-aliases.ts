/**
 * Merged HS aliases for classify cascade (C23/C24): lab hs-aliases + invoice keys.
 */
import labAliases from "../../lbm-bro/lib/hs-aliases.json";
import invoiceAliases from "./tnved-invoice-aliases.json";

export type ClassifyAlias = {
  code: string;
  keys: string[];
  exclude?: string[];
  why: string;
  risk: string;
};

function digits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeClassifyQuery(v: string) {
  return (v || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[-_/\\,.;:()[\]{}+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wholeWord(query: string, key: string) {
  return new RegExp(`(?:^|[^a-zа-я0-9])${escapeRe(key)}(?:$|[^a-zа-я0-9])`, "i").test(query);
}

function excludeHits(query: string, raw: string) {
  const whole = raw.startsWith("=");
  const key = normalizeClassifyQuery(whole ? raw.slice(1) : raw);
  if (!key) return false;
  return wholeWord(query, key);
}

function keyHits(query: string, raw: string) {
  const whole = raw.startsWith("=");
  const key = normalizeClassifyQuery(whole ? raw.slice(1) : raw);
  if (!key) return false;
  if (whole || key.length <= 3) return wholeWord(query, key);
  return query.includes(key);
}

function mergeAliasLists(): ClassifyAlias[] {
  const byCode = new Map<string, ClassifyAlias>();
  for (const row of labAliases as ClassifyAlias[]) {
    const code = digits(row.code);
    if (!code) continue;
    const prev = byCode.get(code);
    if (prev) {
      byCode.set(code, {
        code,
        keys: [...new Set([...prev.keys, ...(row.keys || [])])],
        exclude: [...new Set([...(prev.exclude || []), ...(row.exclude || [])])],
        why: prev.why.length >= (row.why || "").length ? prev.why : row.why,
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
  for (const row of invoiceAliases as Array<{ code: string; keys: string[]; why?: string }>) {
    const code = digits(row.code);
    if (!code) continue;
    const existing = byCode.get(code);
    if (existing) {
      const keys = [...new Set([...existing.keys, ...row.keys])];
      byCode.set(code, {
        ...existing,
        keys,
        why: existing.why || row.why || existing.why,
      });
    } else {
      byCode.set(code, {
        code,
        keys: [...row.keys],
        why: row.why || "Сопоставление по строке инвойса.",
        risk: "Уточните описание товара",
      });
    }
  }
  return [...byCode.values()];
}

export const CLASSIFY_ALIASES: ClassifyAlias[] = mergeAliasLists();

export function scoreClassifyAlias(query: string, alias: ClassifyAlias) {
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

export function matchClassifyAlias(query: string, minScore = 14) {
  const q = normalizeClassifyQuery(query);
  if (!q) return null;
  let best: ClassifyAlias | null = null;
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

export function classifyAliasByCode(code: string) {
  const d = digits(code);
  const exact = CLASSIFY_ALIASES.find((a) => a.code === d);
  if (exact) return exact;
  if (d.length === 9) return CLASSIFY_ALIASES.find((a) => a.code === `${d}0`) || null;
  return null;
}
