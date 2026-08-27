/**
 * Convert lbm-bro classifier pairs into TnvedCode import rows (C18).
 * parentCode = nearest node that exists in the same set (lab json skips most 8-digit).
 */
import {
  buildTnvedImportItem,
  formatHsCode,
  hsCodeLevel,
  normalizeHsCode,
  TNVED_LEVELS,
  type TnvedImportItem,
} from "./tnved";

export { tnvedSearchStems } from "./tnved";

export function nearestParentInSet(code: string, present: Set<string>): string | null {
  const digits = normalizeHsCode(code);
  if (!digits || digits.length <= 2) return null;
  for (let i = TNVED_LEVELS.length - 1; i >= 0; i--) {
    const lvl = TNVED_LEVELS[i];
    if (lvl >= digits.length) continue;
    const parent = digits.slice(0, lvl);
    if (present.has(parent)) return parent;
  }
  return null;
}

/** Household + index tokens for SQL contains (cap matches tnvedCodeSchema). */
export function notesFromSearchTokens(parts: string[], maxLen = 4000): string | undefined {
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const raw of parts) {
    const t = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/ё/g, "е");
    if (t.length < 2 || seen.has(t)) continue;
    seen.add(t);
    uniq.push(t);
  }
  if (!uniq.length) return undefined;
  let out = uniq.join(", ");
  if (out.length > maxLen) out = out.slice(0, maxLen);
  return out;
}

export function labPairToImportItem(
  codeRaw: string,
  titleRu: string,
  present: Set<string>,
  notes?: string,
): TnvedImportItem | null {
  const code = normalizeHsCode(codeRaw);
  if (!code) return null;
  const title = String(titleRu || "").trim();
  if (!title) return null;
  const item = buildTnvedImportItem({
    code,
    titleRu: title,
    isLeaf: code.length === 10,
    notes,
  });
  item.parentCode = nearestParentInSet(code, present);
  item.codeDisplay = formatHsCode(code) || item.codeDisplay;
  item.level = hsCodeLevel(code)!;
  if (!notes) delete (item as { notes?: string | null }).notes;
  return item;
}

export type LabAlias = { code: string; keys: string[]; why?: string };
export type LabIndex = {
  entries?: Array<[string, string, string[], number]>;
  aliasTokens?: Record<string, string[]>;
};

export function composeLabNotes(whyParts: string[] | undefined, tokens: string[] | undefined, maxLen = 4000): string | undefined {
  const why = [...new Set((whyParts || []).map((w) => w.trim()).filter(Boolean))].join(" ");
  const tokBudget = why ? Math.max(32, maxLen - why.length - 1) : maxLen;
  const tok = notesFromSearchTokens(tokens || [], tokBudget);
  const out = why && tok ? `${why}\n${tok}` : why || tok;
  if (!out) return undefined;
  return out.length > maxLen ? out.slice(0, maxLen) : out;
}

export function notesByCodeFromLabSearch(opts: {
  aliases?: LabAlias[];
  index?: LabIndex;
  synonyms?: Record<string, string>;
}): { tokens: Map<string, string[]>; why: Map<string, string[]> } {
  const tokens = new Map<string, string[]>();
  const why = new Map<string, string[]>();
  const addTok = (codeRaw: string, token: string) => {
    const code = normalizeHsCode(codeRaw);
    if (!code || !token) return;
    const row = tokens.get(code) || [];
    row.push(token);
    tokens.set(code, row);
  };
  const addWhy = (codeRaw: string, text: string) => {
    const code = normalizeHsCode(codeRaw);
    const w = String(text || "").trim();
    if (!code || !w) return;
    const row = why.get(code) || [];
    if (!row.includes(w)) row.push(w);
    why.set(code, row);
  };
  for (const a of opts.aliases || []) {
    for (const k of a.keys || []) addTok(a.code, k.replace(/^=/, ""));
    if (a.why) addWhy(a.code, a.why);
  }
  for (const [tok, codes] of Object.entries(opts.index?.aliasTokens || {})) {
    for (const c of codes) addTok(c, tok);
  }
  for (const [code, , toks] of opts.index?.entries || []) {
    for (const t of toks || []) addTok(code, t);
  }
  for (const [code, blob] of Object.entries(opts.synonyms || {})) {
    for (const t of String(blob || "").split(/[,;]+/)) addTok(code, t);
  }
  return { tokens, why };
}

export function labCatalogToImportItems(
  pairs: Array<[string, string]>,
  notesByCode?: Map<string, string[]> | { tokens: Map<string, string[]>; why: Map<string, string[]> },
): TnvedImportItem[] {
  const present = new Set<string>();
  for (const [codeRaw] of pairs) {
    const code = normalizeHsCode(codeRaw);
    if (code) present.add(code);
  }
  const tokenMap = notesByCode instanceof Map ? notesByCode : notesByCode?.tokens;
  const whyMap = notesByCode instanceof Map ? undefined : notesByCode?.why;
  const items: TnvedImportItem[] = [];
  for (const [codeRaw, title] of pairs) {
    const code = normalizeHsCode(codeRaw);
    const notes = code ? composeLabNotes(whyMap?.get(code), tokenMap?.get(code) || []) : undefined;
    const item = labPairToImportItem(codeRaw, title, present, notes);
    if (item) items.push(item);
  }
  items.sort((a, b) => a.level - b.level || a.code.localeCompare(b.code));
  return items;
}
