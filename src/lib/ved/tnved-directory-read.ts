/**
 * Live `/cabinet/tnved` right-pane view-model (C17 + C30).
 * Chrome matches lab `/client/tnved`; rates stay LBM (VAT 22% / ПП 1637).
 * Not a classifier: no tnved.json, no free-peek, no invented low-risk label.
 */
import { formatHsCode, normalizeHsCode } from "./tnved";
import {
  dutySourceNote,
  formatCardDutyLabel,
  type TnvedClassificationDecision,
  type TnvedExplanation,
} from "./tnved-card-layers";

export type DirectoryDutyRate = {
  dutyKind?: string | null;
  dutyPct?: number | null;
  dutyRubPerUnit?: number | null;
  unit?: string | null;
  source?: string | null;
} | null;

export type DirectoryCardLike = {
  code?: string;
  codeDisplay?: string | null;
  titleRu?: string | null;
  notes?: string | null;
  rate?: DirectoryDutyRate;
  explanation?: TnvedExplanation | null;
  classificationDecisions?: TnvedClassificationDecision[];
  paymentsHint?: { vatPct?: number | null; feeRule?: string | null };
  disclaimer?: string | null;
  ancestors?: Array<{ code?: string; codeDisplay?: string | null; titleRu?: string | null }>;
  children?: Array<{
    code?: string;
    codeDisplay?: string | null;
    titleRu?: string | null;
    isLeaf?: boolean;
  }>;
  related?: Array<{ code: string; kind?: string; why?: string }>;
  measuresHint?: {
    excisePossible?: boolean;
    utilSborPossible?: boolean;
    ecoFeePossible?: boolean;
    ntmPossible?: boolean;
  };
};

export type DirectoryRead = {
  hs: string;
  title: string;
  why: string;
  vatPct: number;
  feeRule: string;
  dutyLabel: string;
  notes: string[];
  riskLabel: string;
  riskKind: "ok" | "warn";
  explanation: TnvedExplanation | null;
  classificationDecisions: TnvedClassificationDecision[];
};

export type DirectoryPrefill = {
  hsHint: string;
  name: string;
  title: string;
  description: string;
};

/** @deprecated use formatCardDutyLabel — kept for call-site imports. */
export function formatDirectoryDuty(rate: DirectoryDutyRate): string {
  return formatCardDutyLabel(rate);
}

export function directoryHumanLead(notes: string | null | undefined): string {
  const lead = String(notes || "")
    .trim()
    .split(/\n+/)[0]
    ?.trim() || "";
  if (!lead) return "";
  if (/^ЕЭК\s*PSN:/i.test(lead)) return "";
  const parts = lead.split(",").map((p) => p.trim()).filter(Boolean);
  const looksLikeTokens =
    parts.length >= 3 && parts.every((p) => p.length <= 40) && !/[.!?]/.test(lead);
  if (looksLikeTokens) return "";
  if (lead.length >= 48 || /[.!?]/.test(lead)) return lead;
  return "";
}

export function directoryReadFromCard(
  card: DirectoryCardLike,
  fallback?: { code?: string; codeDisplay?: string | null; titleRu?: string | null },
): DirectoryRead {
  const code = card.code || fallback?.code || "";
  const hs =
    card.codeDisplay ||
    formatHsCode(code) ||
    fallback?.codeDisplay ||
    formatHsCode(fallback?.code) ||
    code;
  const title = (card.titleRu || fallback?.titleRu || "").trim();
  const vatPct = card.paymentsHint?.vatPct != null ? Number(card.paymentsHint.vatPct) : 22;
  const feeRule = card.paymentsHint?.feeRule?.trim() || "ПП 1637";
  const dutyLabel = formatCardDutyLabel(card.rate ?? null);
  const explanation = card.explanation ?? null;
  const classificationDecisions = Array.isArray(card.classificationDecisions)
    ? card.classificationDecisions
    : [];
  const ancestorWhy = (card.ancestors || [])
    .map((a) => (a.titleRu || "").trim())
    .filter(Boolean)
    .at(-1);
  const why =
    directoryHumanLead(card.notes) ||
    explanation?.excerpt.slice(0, 220) ||
    title ||
    ancestorWhy ||
    "Рекомендация справочника, не решение таможенного органа.";

  const notes: string[] = [];
  notes.push(dutySourceNote(card.rate ?? null));
  notes.push(`НДС ${vatPct}% считают в заявке`);
  notes.push(`Таможенный сбор — ${feeRule}`);
  notes.push("Это позиция классификатора ТН ВЭД ЕАЭС, не решение ФТС");

  const m = card.measuresHint;
  const flags: string[] = [];
  if (m?.excisePossible) flags.push("акциз");
  if (m?.utilSborPossible) flags.push("утильсбор");
  if (m?.ecoFeePossible) flags.push("экосбор РОП");
  if (m?.ntmPossible) flags.push("НТМ");
  const riskLabel = flags.length
    ? `Возможны ${flags.join(" / ")} — уточнит брокер`
    : "Уточнит брокер";

  return {
    hs,
    title,
    why,
    vatPct,
    feeRule,
    dutyLabel,
    notes,
    riskLabel,
    riskKind: flags.length ? "warn" : "ok",
    explanation,
    classificationDecisions,
  };
}

export function directoryPrefillFromQuery(hsRaw: string, descRaw: string): DirectoryPrefill | null {
  const hsIn = String(hsRaw || "").trim();
  const desc = String(descRaw || "").trim();
  const hsDisplay = formatHsCode(hsIn) || hsIn;
  if (!normalizeHsCode(hsIn) && !desc) return null;
  const description = desc
    ? hsDisplay
      ? `${desc}\nКод ТН ВЭД: ${hsDisplay}`
      : desc
    : `Код ТН ВЭД: ${hsDisplay}`;
  return {
    hsHint: hsDisplay || "",
    name: desc,
    title: desc,
    description,
  };
}

export function directoryWizardHref(
  newCalcHref: string,
  input: { code: string; titleRu?: string | null },
): string {
  const q = new URLSearchParams();
  q.set("hs", input.code);
  const title = (input.titleRu || "").trim();
  if (title) q.set("desc", title);
  const base = newCalcHref.split("?")[0] || newCalcHref;
  return `${base}?${q.toString()}`;
}
