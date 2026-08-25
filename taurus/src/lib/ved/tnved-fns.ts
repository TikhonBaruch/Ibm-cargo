/**
 * FNS TNVED1–4 TXT parser (cp866 / IBM866) → TnvedCode-shaped nodes.
 * Slice 1 of plan-tnved-opendata-card.md. No Alta/TKS. No invented duty rates.
 */
import { formatHsCode, hsCodeAncestors, parentHsCode } from "./tnved";
import type { TnvedImportItem } from "./tnved";
import { DEFAULT_IMPORT_VAT_PERCENT } from "./customs-fees";
import synonymsJson from "./tnved-demo-synonyms.json";

export const TNVED_FNS_SOURCE = "fns-tnved4";
export const TNVED_DEMO_RATE_SOURCE = "seed-demo-pack+fns-tnved4";
export const TNVED_TITLE_MAX = 2000;
export const TNVED_NOTES_MAX = 4000;

/** Official 10-digit leaves that must be in the demo pack when present in the dump. */
export const DEMO_LEAF_CODES = [
  "8471300000",
  "8471607000",
  "8517130000",
  "6203423100",
  "8708999709",
  "3208909109",
  "1806901900",
  "9403609009",
  "8504405500",
  "8504409100",
  "6404110000",
  "6404199000",
  "4202210000",
  "4202290000",
  "9503007000",
  "9503003000",
  "3304100000",
  "3304200000",
  "8518309500",
  "8518210000",
  "9102110000",
  "6911100000",
  "7318110000",
  "8204110000",
  "8204120000",
  "8539520009",
  "8507600000",
  "8544200000",
  "8544700000",
  "3923100000",
  "3923210000",
] as const;

/** Extra prefixes: take a few current consumer-like leaves if exact list is thin. */
export const DEMO_PREFIXES = [
  "6404",
  "4202",
  "9503",
  "3304",
  "8518",
  "9102",
  "6911",
  "7318",
  "8204",
  "8539",
  "8507",
  "8544",
  "3923",
] as const;

export type FnsDatedRow = {
  code: string;
  titleRu: string;
  notes: string | null;
  validFrom: string | null;
  validTo: string | null;
  current: boolean;
};

export type TnvedNormalizedNode = {
  code: string;
  codeDisplay: string;
  level: 2 | 4 | 6 | 8 | 10;
  parentCode: string | null;
  titleRu: string;
  isLeaf: boolean;
  isActive: boolean;
  notes: string | null;
  validFrom: string | null;
  validTo: string | null;
  source: typeof TNVED_FNS_SOURCE;
};

export type DemoPackFile = {
  source: typeof TNVED_FNS_SOURCE;
  asOf: string;
  layer: "A";
  leafCount: number;
  items: TnvedImportItem[];
};

const HEADER_RE = /^\d+\|\d{8}\|/;
const DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const SKIP_INDUSTRIAL =
  /промышленной сборки|воздушных судов|авиационных двигателей/i;

export function decodeIbm866(buf: Buffer | Uint8Array): string {
  return new TextDecoder("ibm866").decode(buf);
}

export function parseRuDate(raw: string | null | undefined): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const m = DATE_RE.exec(s);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function isCurrentRow(validTo: string | null, asOf = "2026-08-15"): boolean {
  if (!validTo) return true;
  return validTo >= asOf;
}

export function cleanTnvedText(raw: string, max: number): string {
  const collapsed = String(raw || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  if (collapsed.length <= max) return collapsed;
  return collapsed.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

export function stripLeadingDashes(title: string): string {
  return String(title || "")
    .replace(/^(?:[\s\-–—−]+\s*)+/g, "")
    .trim();
}

function splitPipeLine(line: string): string[] {
  return line.replace(/\r$/, "").split("|");
}

function skipHeader(lines: string[]): string[] {
  if (!lines.length) return [];
  if (HEADER_RE.test(lines[0].replace(/\r$/, ""))) return lines.slice(1);
  return lines;
}

function dated(fromRaw: string, toRaw: string, asOf?: string) {
  const validFrom = parseRuDate(fromRaw);
  const validTo = parseRuDate(toRaw);
  return { validFrom, validTo, current: isCurrentRow(validTo, asOf) };
}

/** TNVED2: section|group(2)|title|notes|from|to */
export function parseTnved2Text(text: string, asOf?: string): FnsDatedRow[] {
  const rows: FnsDatedRow[] = [];
  for (const line of skipHeader(text.split(/\n/))) {
    if (!line.trim()) continue;
    const p = splitPipeLine(line);
    if (p.length < 6) continue;
    const code = p[1].trim();
    if (!/^\d{2}$/.test(code) || code === "99") continue;
    const d = dated(p[4], p[5], asOf);
    rows.push({
      code,
      titleRu: cleanTnvedText(p[2], TNVED_TITLE_MAX),
      notes: cleanTnvedText(p[3], TNVED_NOTES_MAX) || null,
      ...d,
    });
  }
  return rows;
}

/** TNVED3: chapter(2)|heading(2)|title|from|to */
export function parseTnved3Text(text: string, asOf?: string): FnsDatedRow[] {
  const rows: FnsDatedRow[] = [];
  for (const line of skipHeader(text.split(/\n/))) {
    if (!line.trim()) continue;
    const p = splitPipeLine(line);
    if (p.length < 5) continue;
    const code = `${p[0].trim()}${p[1].trim()}`;
    if (!/^\d{4}$/.test(code)) continue;
    const d = dated(p[3], p[4], asOf);
    rows.push({
      code,
      titleRu: cleanTnvedText(p[2], TNVED_TITLE_MAX),
      notes: null,
      ...d,
    });
  }
  return rows;
}

/** TNVED4: chapter|heading|rest6|title|from|to → 10-digit leaf */
export function parseTnved4Text(text: string, asOf?: string): FnsDatedRow[] {
  const rows: FnsDatedRow[] = [];
  for (const line of skipHeader(text.split(/\n/))) {
    if (!line.trim()) continue;
    const p = splitPipeLine(line);
    if (p.length < 6) continue;
    const code = `${p[0].trim()}${p[1].trim()}${p[2].trim()}`;
    if (!/^\d{10}$/.test(code) || code.startsWith("99")) continue;
    const d = dated(p[4], p[5], asOf);
    rows.push({
      code,
      titleRu: cleanTnvedText(p[3], TNVED_TITLE_MAX),
      notes: null,
      ...d,
    });
  }
  return rows;
}

function pickCurrentByCode(rows: FnsDatedRow[]): Map<string, FnsDatedRow> {
  const map = new Map<string, FnsDatedRow>();
  for (const row of rows) {
    if (!row.current || !row.titleRu) continue;
    map.set(row.code, row);
  }
  return map;
}

function titleForPrefix(
  prefix: string,
  headings: Map<string, FnsDatedRow>,
  leaves: Map<string, FnsDatedRow>
): string {
  const padded = prefix.padEnd(10, "0");
  const exact = leaves.get(padded);
  if (exact?.titleRu) return exact.titleRu;
  const heading = headings.get(prefix.slice(0, 4));
  let child: FnsDatedRow | undefined;
  for (const leaf of [...leaves.values()].sort((a, b) => a.code.localeCompare(b.code))) {
    if (leaf.code.startsWith(prefix)) {
      child = leaf;
      break;
    }
  }
  if (heading?.titleRu && child?.titleRu) {
    const rest = stripLeadingDashes(child.titleRu);
    if (rest.length >= 2 && rest !== heading.titleRu) {
      return cleanTnvedText(`${heading.titleRu} — ${rest}`, TNVED_TITLE_MAX);
    }
    return heading.titleRu;
  }
  if (heading?.titleRu) return heading.titleRu;
  if (child?.titleRu) return stripLeadingDashes(child.titleRu) || child.titleRu;
  return prefix;
}

export function buildTnvedTree(opts: {
  groups: FnsDatedRow[];
  headings: FnsDatedRow[];
  leaves: FnsDatedRow[];
}): TnvedNormalizedNode[] {
  const groups = pickCurrentByCode(opts.groups);
  const headings = pickCurrentByCode(opts.headings);
  const leaves = pickCurrentByCode(opts.leaves);
  const byCode = new Map<string, TnvedNormalizedNode>();

  const upsert = (node: TnvedNormalizedNode) => {
    const prev = byCode.get(node.code);
    if (!prev) {
      byCode.set(node.code, node);
      return;
    }
    if (node.level === 10 || prev.titleRu.length < node.titleRu.length) {
      byCode.set(node.code, node);
    }
  };

  for (const row of groups.values()) {
    upsert({
      code: row.code,
      codeDisplay: formatHsCode(row.code) || row.code,
      level: 2,
      parentCode: null,
      titleRu: row.titleRu,
      isLeaf: false,
      isActive: true,
      notes: row.notes,
      validFrom: row.validFrom,
      validTo: row.validTo,
      source: TNVED_FNS_SOURCE,
    });
  }

  for (const row of headings.values()) {
    const parentCode = parentHsCode(row.code);
    upsert({
      code: row.code,
      codeDisplay: formatHsCode(row.code) || row.code,
      level: 4,
      parentCode,
      titleRu: row.titleRu,
      isLeaf: false,
      isActive: true,
      notes: null,
      validFrom: row.validFrom,
      validTo: row.validTo,
      source: TNVED_FNS_SOURCE,
    });
  }

  for (const row of leaves.values()) {
    const chain = hsCodeAncestors(row.code);
    for (const code of chain) {
      const level = code.length as 2 | 4 | 6 | 8 | 10;
      if (level === 10) {
        upsert({
          code,
          codeDisplay: formatHsCode(code) || code,
          level,
          parentCode: parentHsCode(code),
          titleRu: row.titleRu,
          isLeaf: true,
          isActive: true,
          notes: null,
          validFrom: row.validFrom,
          validTo: row.validTo,
          source: TNVED_FNS_SOURCE,
        });
        continue;
      }
      if (byCode.has(code)) continue;
      const fromGroup = level === 2 ? groups.get(code) : undefined;
      const fromHeading = level === 4 ? headings.get(code) : undefined;
      const src = fromGroup || fromHeading;
      const titleRu = src?.titleRu || titleForPrefix(code, headings, leaves);
      upsert({
        code,
        codeDisplay: formatHsCode(code) || code,
        level,
        parentCode: parentHsCode(code),
        titleRu,
        isLeaf: false,
        isActive: true,
        notes: src?.notes ?? null,
        validFrom: src?.validFrom ?? row.validFrom,
        validTo: src?.validTo ?? null,
        source: TNVED_FNS_SOURCE,
      });
    }
  }

  return [...byCode.values()].sort((a, b) => a.level - b.level || a.code.localeCompare(b.code));
}

export function nodeToImportItem(node: TnvedNormalizedNode, extraNotes?: string | null): TnvedImportItem {
  const notes = mergeNotes(node.notes, extraNotes);
  return {
    code: node.code,
    codeDisplay: node.codeDisplay,
    level: node.level,
    parentCode: node.parentCode,
    titleRu: node.titleRu,
    titleEn: null,
    isLeaf: node.isLeaf,
    isActive: node.isActive,
    notes,
  };
}

function mergeNotes(...parts: Array<string | null | undefined>): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const t = String(part || "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  if (!out.length) return null;
  return cleanTnvedText(out.join(". "), TNVED_NOTES_MAX);
}

export function synonymsForCode(
  code: string,
  map: Record<string, string> = synonymsJson as Record<string, string>
): string | null {
  const bits: string[] = [];
  if (map[code]) bits.push(map[code]);
  for (let n = 2; n < code.length; n += 2) {
    const prefix = code.slice(0, n);
    if (map[prefix]) bits.push(map[prefix]);
  }
  return bits.length ? bits.join(", ") : null;
}

export function selectDemoLeafCodes(leaves: Array<{ code: string; titleRu?: string }>): string[] {
  const available = new Set(leaves.map((l) => l.code));
  const titleOf = new Map(leaves.map((l) => [l.code, l.titleRu || ""]));
  const picked: string[] = [];
  const seen = new Set<string>();
  const add = (code: string) => {
    if (!available.has(code) || seen.has(code)) return;
    seen.add(code);
    picked.push(code);
  };
  for (const code of DEMO_LEAF_CODES) add(code);

  const byPrefix = new Map<string, string[]>();
  for (const { code } of leaves) {
    for (const prefix of DEMO_PREFIXES) {
      if (!code.startsWith(prefix)) continue;
      const list = byPrefix.get(prefix) || [];
      list.push(code);
      byPrefix.set(prefix, list);
    }
  }
  for (const prefix of DEMO_PREFIXES) {
    const list = (byPrefix.get(prefix) || []).slice().sort((a, b) => {
      const indA = SKIP_INDUSTRIAL.test(titleOf.get(a) || "") ? 1 : 0;
      const indB = SKIP_INDUSTRIAL.test(titleOf.get(b) || "") ? 1 : 0;
      if (indA !== indB) return indA - indB;
      const zA = a.endsWith("0000") ? 0 : 1;
      const zB = b.endsWith("0000") ? 0 : 1;
      if (zA !== zB) return zA - zB;
      return a.localeCompare(b);
    });
    let added = picked.filter((c) => c.startsWith(prefix)).length;
    for (const code of list) {
      if (added >= 4) break;
      if (seen.has(code)) continue;
      add(code);
      added += 1;
    }
  }
  return picked;
}

export function buildDemoPack(
  nodes: TnvedNormalizedNode[],
  opts?: { asOf?: string; synonyms?: Record<string, string> }
): DemoPackFile {
  const byCode = new Map(nodes.map((n) => [n.code, n]));
  const leaves = nodes.filter((n) => n.isLeaf);
  const selected = selectDemoLeafCodes(leaves);
  const needed = new Set<string>();
  for (const leaf of selected) {
    for (const code of hsCodeAncestors(leaf)) needed.add(code);
  }
  const items: TnvedImportItem[] = [...needed]
    .map((code) => byCode.get(code))
    .filter((n): n is TnvedNormalizedNode => Boolean(n))
    .sort((a, b) => a.level - b.level || a.code.localeCompare(b.code))
    .map((node) => {
      const item = nodeToImportItem(
        node,
        node.isLeaf ? synonymsForCode(node.code, opts?.synonyms) : null
      );
      if (node.isLeaf) {
        item.rate = {
          code: node.code,
          dutyKind: "AD_VALOREM",
          dutyPct: null,
          vatPct: DEFAULT_IMPORT_VAT_PERCENT,
          source: TNVED_DEMO_RATE_SOURCE,
        };
      }
      return item;
    });
  return {
    source: TNVED_FNS_SOURCE,
    asOf: opts?.asOf || "2026-04-27",
    layer: "A",
    leafCount: items.filter((i) => i.isLeaf).length,
    items,
  };
}

export function parseFnsDumpTexts(input: {
  tnved2: string;
  tnved3: string;
  tnved4: string;
  asOf?: string;
}): TnvedNormalizedNode[] {
  return buildTnvedTree({
    groups: parseTnved2Text(input.tnved2, input.asOf),
    headings: parseTnved3Text(input.tnved3, input.asOf),
    leaves: parseTnved4Text(input.tnved4, input.asOf),
  });
}
