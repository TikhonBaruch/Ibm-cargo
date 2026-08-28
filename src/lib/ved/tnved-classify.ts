/**
 * Deterministic TN VED classify cascade (C23): code → alias → token index.
 * Postgres for code validation; lab index on server FS. Not an LLM.
 */
import type { AiDraftResult } from "./domain";
import {
  customsOperationsFeeFromUsd,
  DEFAULT_IMPORT_VAT_PERCENT,
} from "./customs-fees";
import {
  buildClassificationQuery,
  classificationText,
  isGenericProductTitle,
  productTitle,
} from "./product-classify-text";
import {
  classifyAliasByCode,
  matchClassifyAlias,
  type ClassifyAlias,
} from "./tnved-classify-aliases";
import {
  classifyByTokenIndex,
  confFromAliasScore,
  titleForClassifyCode,
} from "./tnved-classify-index";
import {
  formatHsCode,
  getTnvedByCode,
  normalizeHsCode,
  pickEttRate,
  type TnvedDb,
} from "./tnved";

export const CASCADE_CONF_THRESHOLD = 0.55;
export const CASCADE_ENGINE = "cascade-v1";

export type ClassifyCascadeInput = {
  description?: string | null;
  title?: string | null;
  name?: string | null;
  country?: string | null;
  ocrText?: string | null;
  shipmentValue?: string | number;
};

export type ClassifyCascadeResult = {
  hsCode: string;
  confidence: number;
  disclaimer: string;
  risk: string;
  why: string;
  engine: typeof CASCADE_ENGINE;
  step: "code" | "alias" | "token";
};

function digits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function looksLikeHsCodeInput(raw: string, d: string) {
  const t = raw.trim();
  if (d.length >= 10) return true;
  if (d.length < 6) return false;
  const stripped = t.replace(/[\s.\-/]/g, "");
  if (/^\d+$/.test(stripped)) return true;
  if (/тн\s*вед|hs\s*code|код\s*тн/i.test(t) && d.length >= 4) return true;
  return false;
}

async function resolveCodeRow(db: TnvedDb, code: string) {
  const normalized = normalizeHsCode(code) || digits(code).slice(0, 10);
  if (!normalized) return null;
  let row = await getTnvedByCode(db, normalized);
  if (row) return row;
  const d = digits(normalized);
  if (d.length === 9) {
    row = await getTnvedByCode(db, `${d}0`);
    if (row) return row;
  }
  const prefix = d.length >= 6 ? d.slice(0, 6) : d.length >= 4 ? d.slice(0, 4) : d.slice(0, 2);
  if (prefix.length >= 2) {
    const hits = await db.tnvedCode.findMany({
      where: { isActive: true, code: { startsWith: prefix } },
      orderBy: [{ level: "desc" }, { code: "asc" }],
      take: 8,
      include: { rates: { orderBy: { validFrom: "desc" }, take: 3 } },
    });
    const exact = hits.find((h) => h.code === d || h.code === `${d}0`);
    if (exact) return exact;
    return hits.sort((a, b) => b.code.length - a.code.length)[0] || null;
  }
  return null;
}

async function classifyByCodeFromText(
  db: TnvedDb,
  raw: string
): Promise<ClassifyCascadeResult | null> {
  const d = digits(raw);
  if (looksLikeHsCodeInput(raw, d)) {
    const hit = await classifyByCode(db, raw);
    if (hit) return hit;
  }
  const m = raw.match(/\b(\d{4}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2})\b/);
  if (m) return classifyByCode(db, m[1]);
  return null;
}

async function classifyByCode(db: TnvedDb, raw: string): Promise<ClassifyCascadeResult | null> {
  const d = digits(raw);
  if (d.length < 4) return null;
  const row = await resolveCodeRow(db, d);
  const code = row?.code || (d.length >= 10 ? d.slice(0, 10) : d.padEnd(10, "0").slice(0, 10));
  const codeDigits = digits(code);
  if (codeDigits.length < 6 && d.length < 10) return null;
  const alias = classifyAliasByCode(code);
  const hs = formatHsCode(code) || code;
  if (row) {
    const exact = d.length >= 10 && row.code === d.slice(0, 10);
    return {
      hsCode: hs,
      confidence: exact ? 0.96 : row.code.length === 10 ? 0.94 : 0.92,
      why: row.titleRu,
      risk: alias?.risk || "Уточните описание товара",
      disclaimer: `${row.titleRu}. Рекомендация cascade-v1, не решение таможни. Финал — брокер.`,
      engine: CASCADE_ENGINE,
      step: "code",
    };
  }
  if (alias) {
    return {
      hsCode: hs,
      confidence: 0.9,
      why: alias.why,
      risk: alias.risk,
      disclaimer: `${alias.why} Рекомендация cascade-v1, не решение таможни. Финал — брокер.`,
      engine: CASCADE_ENGINE,
      step: "code",
    };
  }
  return null;
}

function aliasResult(hit: { alias: ClassifyAlias; score: number }): ClassifyCascadeResult {
  const hs = formatHsCode(hit.alias.code) || hit.alias.code;
  return {
    hsCode: hs,
    confidence: confFromAliasScore(hit.score),
    why: hit.alias.why,
    risk: hit.alias.risk,
    disclaimer: `${hit.alias.why} Рекомендация cascade-v1, не решение таможни. Финал — брокер.`,
    engine: CASCADE_ENGINE,
    step: "alias",
  };
}

function classifyByAlias(raw: string): ClassifyCascadeResult | null {
  const title = productTitle(raw);
  const text = classificationText(raw);
  const titleHit = matchClassifyAlias(title);
  const textHit = text !== title ? matchClassifyAlias(text) : null;

  if (titleHit && !isGenericProductTitle(title)) {
    return aliasResult(titleHit);
  }

  if (titleHit && textHit && titleHit.alias.code !== textHit.alias.code) {
    if (titleHit.score >= textHit.score - 8) return aliasResult(titleHit);
    return aliasResult(textHit);
  }

  const hit = titleHit || textHit || matchClassifyAlias(raw);
  if (!hit) return null;
  return aliasResult(hit);
}

function classifyByTokens(raw: string): ClassifyCascadeResult | null {
  const tabletish = /(?:ipad|tablet|планшет)/i.test(raw) && !/(?:laptop|ноутбук|macbook|thinkpad)/i.test(raw);
  const hit = classifyByTokenIndex(raw);
  if (!hit) return null;
  if (tabletish && hit.code.startsWith("847130")) return null;
  const alias = classifyAliasByCode(hit.code);
  const title = titleForClassifyCode(hit.code);
  const why = title || alias?.why || "Сопоставление по словам классификатора.";
  return {
    hsCode: formatHsCode(hit.code) || hit.code,
    confidence: hit.confidence,
    why,
    risk: alias?.risk || "Уточните описание товара",
    disclaimer: `${why} Рекомендация cascade-v1, не решение таможни. Финал — брокер.`,
    engine: CASCADE_ENGINE,
    step: "token",
  };
}

export async function classifyTnvedCascade(
  db: TnvedDb,
  input: ClassifyCascadeInput
): Promise<ClassifyCascadeResult | null> {
  const desc = [input.title, input.name, input.description].filter(Boolean).join(" ").trim()
    || String(input.description || "").trim();
  const raw =
    buildClassificationQuery(desc, { ocrText: input.ocrText }) ||
    classificationText(desc).trim() ||
    desc;
  if (!raw) return null;

  const byCode = await classifyByCodeFromText(db, raw);
  if (byCode) return byCode;

  const byAlias = classifyByAlias(raw);
  if (byAlias) return byAlias;

  return classifyByTokens(raw);
}

async function dutiesForCode(
  db: TnvedDb,
  hsCode: string,
  shipmentValue?: string | number
): Promise<AiDraftResult["duties"]> {
  const code = normalizeHsCode(hsCode);
  const row = code ? await getTnvedByCode(db, code) : null;
  const rates = row?.rates || [];
  const ett = pickEttRate(rates);
  const dutyPct = ett?.dutyPct ?? 0;
  const vatPct = rates[0]?.vatPct ?? DEFAULT_IMPORT_VAT_PERCENT;
  const usd = Number(shipmentValue) || 18_000;
  return {
    customsDutyPercent: dutyPct,
    vatPercent: vatPct,
    feeRub: customsOperationsFeeFromUsd(usd),
    note: `${CASCADE_ENGINE} · vat=${vatPct} · fee=PP1637`,
  };
}

/** Build AiDraftResult from cascade; null when no match or below threshold vs caller. */
export async function buildCascadeDraft(
  db: TnvedDb,
  input: ClassifyCascadeInput
): Promise<AiDraftResult | null> {
  const hit = await classifyTnvedCascade(db, input);
  if (!hit) return null;
  const duties = await dutiesForCode(db, hit.hsCode, input.shipmentValue);
  return {
    hsCode: hit.hsCode,
    confidence: hit.confidence,
    disclaimer: hit.disclaimer,
    duties,
    documents: ["Инвойс", "Packing list", "Контракт", "Сертификат соответствия (при необходимости)"],
    inputPreview: buildClassificationQuery(
      [input.title, input.name, input.description].filter(Boolean).join(" ").trim(),
      { ocrText: input.ocrText }
    ).slice(0, 200),
    engine: hit.engine,
  };
}

export function pickCascadeOrHeuristic(
  cascade: AiDraftResult | null,
  heuristic: AiDraftResult
): AiDraftResult {
  if (!cascade) return heuristic;
  if (cascade.confidence >= CASCADE_CONF_THRESHOLD && cascade.confidence >= heuristic.confidence - 0.02) {
    return cascade;
  }
  if (cascade.confidence >= 0.72 && heuristic.confidence < 0.6) {
    return cascade;
  }
  return heuristic;
}

/** Top-N alias/token candidates for UI preview (C26). */
export async function rankCascadeCandidates(
  db: TnvedDb,
  input: ClassifyCascadeInput,
  limit = 3
): Promise<Array<{ hsCode: string; confidence: number; why: string }>> {
  const primary = await classifyTnvedCascade(db, input);
  const out: Array<{ hsCode: string; confidence: number; why: string }> = [];
  if (primary) {
    out.push({ hsCode: primary.hsCode, confidence: primary.confidence, why: primary.why });
  }
  const desc = buildClassificationQuery(
    [input.title, input.name, input.description].filter(Boolean).join(" ").trim(),
    { ocrText: input.ocrText }
  );
  const alias = matchClassifyAlias(desc);
  if (alias && !out.some((r) => r.hsCode === formatHsCode(alias.alias.code))) {
    out.push({
      hsCode: formatHsCode(alias.alias.code) || alias.alias.code,
      confidence: confFromAliasScore(alias.score),
      why: alias.alias.why,
    });
  }
  return out.slice(0, limit);
}
