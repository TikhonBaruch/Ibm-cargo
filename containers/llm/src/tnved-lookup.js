/**
 * Corpus-backed TN VED leaf lookup (lexical top-K).
 * Path: TNVED_CODES_PATH or ../../../../data/tnved/normalized/codes.jsonl
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOP_K = Math.min(20, Math.max(4, Number(process.env.LLM_LOOKUP_TOP_K || 10)));

/** Everyday query → tokens / HS prefixes that appear in official titles */
const EXPAND = [
  { test: /ноутбук|laptop|notebook|macbook|нетбук/i, tokens: ["портативн", "вычислительн", "машин"], prefixes: ["847130"] },
  { test: /компьютер|пк\b|desktop|сервер/i, tokens: ["вычислительн", "машин"], prefixes: ["8471"] },
  { test: /телефон|смартфон|iphone|android|mobile\s*phone/i, tokens: ["телефон", "аппараты"], prefixes: ["8517"] },
  { test: /мебел|стул|стол|sofa|диван/i, tokens: ["мебел"], prefixes: ["9403"] },
  { test: /шоколад|chocolate/i, tokens: ["шоколад"], prefixes: ["1806"] },
  { test: /куртк|одежд|текстил|хлопок|cotton/i, tokens: ["мужск", "брюк", "хлопчат"], prefixes: ["6203"] },
];

export function digitsHs(code) {
  return String(code || "").replace(/\D/g, "");
}

export function formatHs(digits) {
  const d = digitsHs(digits);
  if (d.length !== 10) return String(digits || "");
  return `${d.slice(0, 4)} ${d.slice(4, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^a-zа-я0-9]+/i)
    .filter((t) => t.length >= 3);
}

function defaultCodesPath() {
  if (process.env.TNVED_CODES_PATH) return process.env.TNVED_CODES_PATH;
  // D36: LBM-owned paths only — never nested ./llm or taurus/llm
  const candidates = [
    path.resolve(__dirname, "../data/tnved/normalized/codes.jsonl"),
    path.resolve(process.cwd(), "containers/llm/data/tnved/normalized/codes.jsonl"),
    path.resolve(process.cwd(), "scripts/data/tnved/normalized/codes.jsonl"),
    "/data/tnved/normalized/codes.jsonl",
    "/data/tnved/codes.jsonl",
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

/**
 * @returns {{ leaves: Array, byCode: Map<string, object>, path: string, loaded: boolean }}
 */
export function loadTnvedLeaves() {
  const filePath = defaultCodesPath();
  const byCode = new Map();
  const leaves = [];
  if (!fs.existsSync(filePath)) {
    console.warn(`[tnved-lookup] codes not found: ${filePath}`);
    return { leaves, byCode, path: filePath, loaded: false };
  }
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (!row?.isLeaf || !row.code) continue;
    const dig = digitsHs(row.code);
    if (dig.length !== 10) continue;
    const leaf = {
      code: dig,
      codeDisplay: row.codeDisplay || formatHs(dig),
      titleRu: String(row.titleRu || "").slice(0, 240),
      dutyPct: row.duty?.dutyPct != null ? Number(row.duty.dutyPct) : null,
      dutyKind: row.duty?.dutyKind || null,
      dutyNote: row.duty?.note || null,
    };
    leaves.push(leaf);
    byCode.set(dig, leaf);
  }
  console.log(`[tnved-lookup] loaded ${leaves.length} leaves from ${filePath}`);
  return { leaves, byCode, path: filePath, loaded: leaves.length > 0 };
}

function expandQuery(text) {
  const tokens = new Set(tokenize(text));
  const prefixes = new Set();
  for (const rule of EXPAND) {
    if (!rule.test.test(text)) continue;
    for (const t of rule.tokens) tokens.add(t);
    for (const p of rule.prefixes) prefixes.add(p);
  }
  return { tokens: [...tokens], prefixes: [...prefixes] };
}

/**
 * Lexical top-K among leaves. Returns [{ code, codeDisplay, titleRu, dutyPct, score }]
 */
export function lexicalCandidates(queryText, leaves, k = TOP_K) {
  const { tokens, prefixes } = expandQuery(queryText);
  if (!tokens.length && !prefixes.length) return [];

  const scored = [];
  for (const leaf of leaves) {
    const hay = leaf.titleRu.toLowerCase().replace(/ё/g, "е");
    let score = 0;
    for (const t of tokens) {
      if (hay.includes(t)) score += Math.min(12, t.length);
    }
    for (const p of prefixes) {
      if (leaf.code.startsWith(p)) score += 40 + Math.min(20, p.length);
    }
    if (score > 0) scored.push({ ...leaf, score });
  }
  scored.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  return scored.slice(0, k).map(({ score, ...rest }) => ({ ...rest, score }));
}

export function getLeaf(byCode, hsCode) {
  return byCode.get(digitsHs(hsCode)) || null;
}

export { TOP_K };
