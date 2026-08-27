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

export type LabAlias = { code: string; keys: string[] };
export type LabIndex = {
  entries?: Array<[string, string, string[], number]>;
  aliasTokens?: Record<string, string[]>;
};

export function notesByCodeFromLabSearch(opts: {
  aliases?: LabAlias[];
  index?: LabIndex;
}): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (codeRaw: string, token: string) => {
    const code = normalizeHsCode(codeRaw);
    if (!code || !token) return;
    const row = map.get(code) || [];
    row.push(token);
    map.set(code, row);
  };
  for (const a of opts.aliases || []) {
    for (const k of a.keys || []) add(a.code, k.replace(/^=/, ""));
  }
  for (const [tok, codes] of Object.entries(opts.index?.aliasTokens || {})) {
    for (const c of codes) add(c, tok);
  }
  for (const [code, , toks] of opts.index?.entries || []) {
    for (const t of toks || []) add(code, t);
  }
  return map;
}

export function labCatalogToImportItems(
  pairs: Array<[string, string]>,
  notesByCode?: Map<string, string[]>,
): TnvedImportItem[] {
  const present = new Set<string>();
  for (const [codeRaw] of pairs) {
    const code = normalizeHsCode(codeRaw);
    if (code) present.add(code);
  }
  const items: TnvedImportItem[] = [];
  for (const [codeRaw, title] of pairs) {
    const code = normalizeHsCode(codeRaw);
    const notes = code ? notesFromSearchTokens(notesByCode?.get(code) || []) : undefined;
    const item = labPairToImportItem(codeRaw, title, present, notes);
    if (item) items.push(item);
  }
  items.sort((a, b) => a.level - b.level || a.code.localeCompare(b.code));
  return items;
}
