/**
 * Curated everyday-language → HS code aliases (lbm-bro directory/classify).
 * Single matcher used by Postgres searchTnvedCodes and the UI lab.
 */
import aliases from "../../lbm-bro/lib/hs-aliases.json";

export type HsAlias = {
  code: string;
  keys: string[];
  exclude?: string[];
  why: string;
  risk: string;
};

export const HS_ALIASES = aliases as HsAlias[];

function digits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeQuery(v: string) {
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

function keyHits(query: string, raw: string) {
  const whole = raw.startsWith("=");
  const key = normalizeQuery(whole ? raw.slice(1) : raw);
  if (!key) return false;
  if (whole || key.length <= 3) return wholeWord(query, key);
  return query.includes(key);
}

export function scoreAlias(query: string, alias: HsAlias) {
  if (alias.exclude?.some((k) => keyHits(query, k))) return 0;
  let score = 0;
  for (const k of alias.keys) {
    if (!keyHits(query, k)) continue;
    const len = normalizeQuery(k.startsWith("=") ? k.slice(1) : k).length;
    score += 10 + len * 4;
    if (len >= 10) score += 8;
  }
  return score;
}

export function matchAlias(query: string, minScore = 14) {
  const q = normalizeQuery(query);
  if (!q) return null;
  let best: HsAlias | null = null;
  let bestScore = 0;
  for (const alias of HS_ALIASES) {
    const s = scoreAlias(q, alias);
    if (s > bestScore) {
      best = alias;
      bestScore = s;
    }
  }
  if (!best || bestScore < minScore) return null;
  return { alias: best, score: bestScore };
}

export function aliasByCode(code: string) {
  const d = digits(code);
  const exact = HS_ALIASES.find((a) => a.code === d);
  if (exact) return exact;
  if (d.length === 9) return HS_ALIASES.find((a) => a.code === `${d}0`) || null;
  return null;
}

/** Collect code prefixes + title tokens from aliases that score on this query. */
export function expandFromAliases(query: string, minScore = 10) {
  const q = normalizeQuery(query);
  const expandPrefixes: string[] = [];
  const expandTokens: string[] = [];
  if (!q) return { expandPrefixes, expandTokens, hits: [] as Array<{ alias: HsAlias; score: number }> };

  const hits: Array<{ alias: HsAlias; score: number }> = [];
  for (const alias of HS_ALIASES) {
    const s = scoreAlias(q, alias);
    if (s < minScore) continue;
    hits.push({ alias, score: s });
    const code = digits(alias.code);
    if (code.length >= 4) expandPrefixes.push(code.slice(0, Math.min(6, code.length)));
    for (const k of alias.keys) {
      const tok = normalizeQuery(k.startsWith("=") ? k.slice(1) : k);
      if (tok.length >= 4) expandTokens.push(tok.slice(0, Math.min(tok.length, 12)));
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return {
    expandPrefixes: [...new Set(expandPrefixes)],
    expandTokens: [...new Set(expandTokens)].slice(0, 12),
    hits,
  };
}
