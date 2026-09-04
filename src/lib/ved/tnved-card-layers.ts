/**
 * Card layers B/D/E helpers (C30): honest duty labels, PSN excerpt, EEC decisions join.
 * Overlays are fail-open — missing files / empty index never invent rates or decisions.
 */
import psnFile from "./tnved-psn-excerpts.json";
import decisionsFile from "./tnved-classification-decisions.json";

export type CardDutyRate = {
  dutyKind?: string | null;
  dutyPct?: number | null;
  dutyRubPerUnit?: number | null;
  unit?: string | null;
  source?: string | null;
} | null;

export type TnvedExplanation = {
  heading: string;
  excerpt: string;
  url: string | null;
  origin: "notes" | "overlay";
};

export type TnvedClassificationDecision = {
  code: string;
  title: string;
  url: string | null;
  asOf: string | null;
};

const TWS_SOURCE_RE = /tws/i;
const NSI_SOURCE_RE = /ett|stnvedst|egov|nsi|тариф/i;
const PSN_NOTES_RE = /^ЕЭК\s*PSN:\s*(.+?)\.\s+([\s\S]+)$/i;

type PsnPack = {
  asOf?: string | null;
  sourceUrl?: string | null;
  groups?: Record<string, { heading?: string; excerpt?: string; url?: string | null }>;
};

type DecisionsPack = {
  asOf?: string | null;
  sourceUrl?: string | null;
  items?: Array<{
    code?: string;
    title?: string;
    url?: string | null;
    asOf?: string | null;
  }>;
};

const psnPack = psnFile as PsnPack;
const decisionsPack = decisionsFile as DecisionsPack;

function digits(code: string | null | undefined): string {
  return String(code || "").replace(/\D/g, "");
}

/** C30a: never invent a rate; label TWS ориентир vs missing NSI honestly (RU, no eng jargon). */
export function formatCardDutyLabel(rate: CardDutyRate): string {
  if (!rate || (rate.dutyPct == null && rate.dutyRubPerUnit == null)) {
    return "нет в НСИ";
  }
  let value = "";
  if (rate.dutyKind === "SPECIFIC" && rate.dutyRubPerUnit != null) {
    value = `${rate.dutyRubPerUnit} ₽${rate.unit ? ` / ${rate.unit}` : ""}`;
  } else if (rate.dutyPct != null) {
    value = `${rate.dutyPct}%`;
  } else if (rate.dutyRubPerUnit != null) {
    value = `${rate.dutyRubPerUnit} ₽${rate.unit ? ` / ${rate.unit}` : ""}`;
  } else {
    return "нет в НСИ";
  }
  const src = String(rate.source || "");
  if (TWS_SOURCE_RE.test(src) && !NSI_SOURCE_RE.test(src)) {
    return `${value} · ориентир TWS (не НСИ)`;
  }
  return value;
}

export function dutySourceNote(rate: CardDutyRate): string {
  if (!rate || (rate.dutyPct == null && rate.dutyRubPerUnit == null)) {
    return "Пошлина ЕТТ — нет в НСИ (СТНВЭДСТ / официальный XML недоступны анонимно)";
  }
  const src = String(rate.source || "");
  if (TWS_SOURCE_RE.test(src) && !NSI_SOURCE_RE.test(src)) {
    return "Пошлина — ориентир TWS, не официальный НСИ ЕТТ";
  }
  if (NSI_SOURCE_RE.test(src)) {
    return `Пошлина ЕТТ · источник ${src}`;
  }
  return `Ориентир пошлины · источник ${src || "каталог"}`;
}

export function parsePsnFromNotes(notes: string | null | undefined): TnvedExplanation | null {
  const lead = String(notes || "")
    .trim()
    .split(/\n+/)[0]
    ?.trim();
  if (!lead) return null;
  const m = lead.match(PSN_NOTES_RE);
  if (!m) return null;
  const heading = m[1].trim();
  const excerpt = m[2].replace(/\s+/g, " ").trim().slice(0, 1200);
  if (!heading || !excerpt) return null;
  return {
    heading,
    excerpt,
    url: psnPack.sourceUrl || null,
    origin: "notes",
  };
}

export function lookupPsnExplanation(input: {
  code: string;
  notes?: string | null;
  ancestors?: Array<{ code?: string; notes?: string | null; level?: number }>;
}): TnvedExplanation | null {
  const fromOwn = parsePsnFromNotes(input.notes);
  if (fromOwn) return fromOwn;
  for (const a of input.ancestors || []) {
    const hit = parsePsnFromNotes(a.notes);
    if (hit) return hit;
  }
  const group = digits(input.code).slice(0, 2);
  if (group.length !== 2) return null;
  const row = psnPack.groups?.[group];
  if (!row?.excerpt?.trim()) return null;
  return {
    heading: String(row.heading || `Группа ${group}`).trim(),
    excerpt: String(row.excerpt).replace(/\s+/g, " ").trim().slice(0, 1200),
    url: row.url ?? psnPack.sourceUrl ?? null,
    origin: "overlay",
  };
}

function buildDecisionIndex(pack: DecisionsPack): Map<string, TnvedClassificationDecision[]> {
  const map = new Map<string, TnvedClassificationDecision[]>();
  for (const raw of pack.items || []) {
    const code = digits(raw.code);
    if (code.length !== 10) continue;
    const title = String(raw.title || "").trim();
    if (!title) continue;
    const row: TnvedClassificationDecision = {
      code,
      title,
      url: raw.url ?? pack.sourceUrl ?? null,
      asOf: raw.asOf ?? pack.asOf ?? null,
    };
    const list = map.get(code) || [];
    list.push(row);
    map.set(code, list);
  }
  return map;
}

const decisionIndex = buildDecisionIndex(decisionsPack);

/** C30d: join by 10-digit; empty when index has no hit (fail-open). */
export function lookupClassificationDecisions(
  codeRaw: string,
  limit = 5,
): TnvedClassificationDecision[] {
  const code = digits(codeRaw);
  if (code.length !== 10) return [];
  return (decisionIndex.get(code) || []).slice(0, Math.max(1, Math.min(limit, 10)));
}

/** Test/ops helper: merge extra decisions without mutating the shipped empty index permanently. */
export function classificationDecisionsFromItems(
  items: DecisionsPack["items"],
  codeRaw: string,
  limit = 5,
): TnvedClassificationDecision[] {
  return buildDecisionIndex({ ...decisionsPack, items: items || [] }).get(digits(codeRaw))?.slice(
    0,
    Math.max(1, Math.min(limit, 10)),
  ) || [];
}
