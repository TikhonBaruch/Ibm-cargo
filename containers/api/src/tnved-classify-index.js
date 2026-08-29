/**
 * Mirror of src/lib/ved/tnved-classify-index.ts — lab token index for cascade.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let cache = null;
let inverted = null;
let titleByCode = null;

export function tnvedClassifyIndexPath() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "tnved-index.json"),
    path.join(process.cwd(), "public/lbm-bro/data/tnved-index.json"),
    path.join(here, "../../../public/lbm-bro/data/tnved-index.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

export function loadClassifyIndex() {
  if (cache) return cache;
  const p = tnvedClassifyIndexPath();
  if (!existsSync(p)) return null;
  try {
    cache = JSON.parse(readFileSync(p, "utf8"));
    inverted = null;
    titleByCode = new Map((cache.entries || []).map(([code, title]) => [code, title]));
    return cache;
  } catch {
    return null;
  }
}

function ensureInverted(index) {
  if (inverted) return inverted;
  const map = new Map();
  for (const [code, , toks, generic] of index.entries || []) {
    for (const t of toks) {
      if (!map.has(t)) map.set(t, new Map());
      const row = map.get(t);
      row.set(code, Math.max(row.get(code) || 0, generic ? 3 : 8));
    }
  }
  for (const [tok, codes] of Object.entries(index.aliasTokens || {})) {
    if (!map.has(tok)) map.set(tok, new Map());
    const row = map.get(tok);
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

export function titleForClassifyCode(code) {
  loadClassifyIndex();
  return titleByCode?.get(String(code || "").replace(/\D/g, "")) || "";
}

export function resetClassifyIndexCache() {
  cache = null;
  inverted = null;
  titleByCode = null;
}

export const CLASSIFY_TOKEN_MIN = 12;
export const CLASSIFY_TOKEN_WEAK = 18;

export function confFromAliasScore(score) {
  return Math.min(0.94, (84 + Math.min(10, Math.floor(score / 8))) / 100);
}

export function confFromTokenScore(score) {
  if (score >= CLASSIFY_TOKEN_WEAK + 8) {
    return Math.min(0.88, (72 + Math.floor((score - CLASSIFY_TOKEN_WEAK) / 2)) / 100);
  }
  if (score >= CLASSIFY_TOKEN_WEAK) {
    return Math.min(0.7, (58 + Math.floor((score - CLASSIFY_TOKEN_MIN) / 2)) / 100);
  }
  return 0;
}

const STOP = new Set([
  "для",
  "или",
  "из",
  "на",
  "при",
  "без",
  "не",
  "и",
  "в",
  "с",
  "по",
  "от",
  "до",
  "the",
  "and",
  "for",
  "with",
]);

export function classifyQueryTokens(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

export function classifyByTokenIndex(raw) {
  const inv = getClassifyInvertedIndex();
  if (!inv) return null;
  const toks = classifyQueryTokens(raw);
  if (!toks.length) return null;
  const scores = new Map();
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
