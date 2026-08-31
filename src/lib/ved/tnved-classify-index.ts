/**
 * Server-side TN VED token index (lab tnved-index.json, not loaded in browser).
 */
import { existsSync, readFileSync } from "fs";
import path from "path";

type IndexEntry = [string, string, string[], number];
type IndexRaw = {
  asOf?: string;
  entries: IndexEntry[];
  aliasTokens?: Record<string, string[]>;
};

let cache: IndexRaw | null = null;
let inverted: Map<string, Map<string, number>> | null = null;
let titleByCode: Map<string, string> | null = null;

export function tnvedClassifyIndexPath() {
  return path.join(process.cwd(), "public/lbm-bro/data/tnved-index.json");
}

export function loadClassifyIndex(): IndexRaw | null {
  if (cache) return cache;
  const p = tnvedClassifyIndexPath();
  if (!existsSync(p)) return null;
  try {
    cache = JSON.parse(readFileSync(p, "utf8")) as IndexRaw;
    inverted = null;
    titleByCode = new Map((cache.entries || []).map(([code, title]) => [code, title]));
    return cache;
  } catch {
    return null;
  }
}

function ensureInverted(index: IndexRaw) {
  if (inverted) return inverted;
  const map = new Map<string, Map<string, number>>();
  for (const [code, , toks, generic] of index.entries || []) {
    for (const t of toks) {
      if (!map.has(t)) map.set(t, new Map());
      const row = map.get(t)!;
      row.set(code, Math.max(row.get(code) || 0, generic ? 3 : 8));
    }
  }
  for (const [tok, codes] of Object.entries(index.aliasTokens || {})) {
    if (!map.has(tok)) map.set(tok, new Map());
    const row = map.get(tok)!;
    for (const code of codes) row.set(code, Math.max(row.get(code) || 0, 15));
  }
  inverted = map;
  return map;
}

export function getClassifyInvertedIndex() {
  const index = loadClassifyIndex();
  if (!index) return null;
  return ensureInverted(index);
}

export function titleForClassifyCode(code: string) {
  loadClassifyIndex();
  return titleByCode?.get(code.replace(/\D/g, "")) || "";
}

/** Test hook: reset module cache. */
export function resetClassifyIndexCache() {
  cache = null;
  inverted = null;
  titleByCode = null;
}

export const CLASSIFY_TOKEN_MIN = 12;
export const CLASSIFY_TOKEN_WEAK = 18;

export function confFromAliasScore(score: number) {
  return Math.min(0.94, (84 + Math.min(10, Math.floor(score / 8))) / 100);
}

export function confFromTokenScore(score: number) {
  if (score >= CLASSIFY_TOKEN_WEAK + 8) {
    return Math.min(0.88, (72 + Math.floor((score - CLASSIFY_TOKEN_WEAK) / 2)) / 100);
  }
  if (score >= CLASSIFY_TOKEN_WEAK) {
    return Math.min(0.7, (58 + Math.floor((score - CLASSIFY_TOKEN_MIN) / 2)) / 100);
  }
  return 0;
}

const STOP = new Set([
  "для", "или", "из", "на", "при", "без", "не", "и", "в", "с", "по", "от", "до", "the", "and", "for", "with",
]);

export function classifyQueryTokens(text: string) {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

export function classifyByTokenIndex(raw: string): {
  code: string;
  score: number;
  confidence: number;
  title: string;
} | null {
  const inv = getClassifyInvertedIndex();
  if (!inv) return null;
  const toks = classifyQueryTokens(raw);
  if (!toks.length) return null;
  const scores = new Map<string, number>();
  for (const t of toks) {
    const row = inv.get(t);
    if (!row) continue;
    for (const [code, w] of row) {
      scores.set(code, (scores.get(code) || 0) + w);
    }
  }
  let bestCode = "";
  let bestScore = 0;
  for (const [code, score] of scores) {
    if (score > bestScore) {
      bestCode = code;
      bestScore = score;
    } else if (score === bestScore && bestCode) {
      const a = titleForClassifyCode(code).length;
      const b = titleForClassifyCode(bestCode).length;
      if (a > b) bestCode = code;
    }
  }
  if (!bestCode || bestScore < CLASSIFY_TOKEN_MIN) return null;
  const confidence = confFromTokenScore(bestScore);
  if (!confidence) return null;
  return {
    code: bestCode,
    score: bestScore,
    confidence,
    title: titleForClassifyCode(bestCode),
  };
}
