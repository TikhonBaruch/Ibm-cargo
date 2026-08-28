/**
 * Cross-heading TNVED forks (C20). Tree parentCode stays in Postgres;
 * this overlay is git-canonical like invoice aliases — not a junction table.
 * Keep this file free of `tnved.ts` imports (card assembler imports us).
 */
import overlayJson from "./tnved-relation-edges.json";

function normalizeHsCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  if (![2, 4, 6, 8, 10].includes(digits.length)) return null;
  return digits;
}

function formatHsCode(code: string | null | undefined): string | null {
  const digits = normalizeHsCode(code);
  if (!digits) return null;
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 2) parts.push(digits.slice(i, i + 2));
  return parts.join(" ");
}

export const TNVED_RELATION_KINDS = ["not", "variant", "part", "kit"] as const;
export type TnvedRelationKind = (typeof TNVED_RELATION_KINDS)[number];

export type TnvedRelation = {
  code: string;
  kind: TnvedRelationKind;
  why: string;
};

export const TNVED_RELATION_KIND_LABEL: Record<TnvedRelationKind, string> = {
  not: "Не путать",
  variant: "Вариант",
  part: "Целое / части",
  kit: "Комплект инвойса",
};

type OverlayEdge = {
  from: string;
  to: string;
  kind: TnvedRelationKind;
  why: string;
  symmetric?: boolean;
};

type OverlayFile = { asOf?: string; edges: OverlayEdge[] };

const overlay = overlayJson as OverlayFile;

function isKind(value: string): value is TnvedRelationKind {
  return (TNVED_RELATION_KINDS as readonly string[]).includes(value);
}

function pushRel(map: Map<string, TnvedRelation[]>, fromRaw: string, toRaw: string, kind: TnvedRelationKind, why: string) {
  const from = normalizeHsCode(fromRaw);
  const to = normalizeHsCode(toRaw);
  if (!from || !to || from === to) return;
  const row = map.get(from) || [];
  if (row.some((r) => r.code === to && r.kind === kind)) return;
  row.push({ code: to, kind, why });
  map.set(from, row);
}

function buildIndex(file: OverlayFile): Map<string, TnvedRelation[]> {
  const map = new Map<string, TnvedRelation[]>();
  for (const edge of file.edges || []) {
    if (!isKind(edge.kind)) continue;
    pushRel(map, edge.from, edge.to, edge.kind, edge.why);
    if (edge.symmetric !== false) pushRel(map, edge.to, edge.from, edge.kind, edge.why);
  }
  return map;
}

const index = buildIndex(overlay);

export const TNVED_RELATIONS_AS_OF = overlay.asOf || "2026-08-28";

export function relationsForCode(codeRaw: string | null | undefined): TnvedRelation[] {
  const code = normalizeHsCode(codeRaw);
  if (!code) return [];
  return index.get(code) || [];
}

/** Codes that receive relation notes on --search-extras. */
export function relationFocusCodes(): string[] {
  return [...index.keys()];
}

export function relationsAsSearchExtras(): Map<string, { why: string[]; tokens: string[] }> {
  const out = new Map<string, { why: string[]; tokens: string[] }>();
  for (const [code, rels] of index) {
    const tokens: string[] = [];
    for (const rel of rels) {
      const label = TNVED_RELATION_KIND_LABEL[rel.kind];
      const hs = formatHsCode(rel.code) || rel.code;
      tokens.push(rel.code, hs, label.toLowerCase(), "связь", "зависимость");
      if (rel.kind === "not") tokens.push("не путать");
    }
    out.set(code, { why: [], tokens });
  }
  return out;
}
