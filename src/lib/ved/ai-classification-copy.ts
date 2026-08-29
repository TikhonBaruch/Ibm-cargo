/**
 * Client-safe copy for live AI classification hero (C22).
 * Uses aiDraft.disclaimer — not hsCodeFinal (D15).
 */

export const AI_CLASSIFY_LOW_CONF = 0.55;

type DraftLike = {
  disclaimer?: string | null;
  confidence?: number | null;
  llmEnrich?: string | null;
};

type CalcLike = {
  hsCode?: string | null;
  hsCodeFinal?: string | null;
  confidence?: number | null;
  description?: string | null;
  aiDraft?: DraftLike | null;
};

const TEST_MODE_DISCLAIMER_RE =
  /Тестовый режим:[^.]*\.\s*Использован запасной путь;[^.]*\.?/gi;

export const AI_DRAIN_STATUS_MSGS = [
  "Читаем документы OCR…",
  "Сверяем описание со справочником ТН ВЭД…",
  "Подбираем код…",
] as const;

export function calcConfidenceRatio(calc: CalcLike): number | null {
  const raw =
    typeof calc.confidence === "number"
      ? calc.confidence
      : typeof calc.aiDraft?.confidence === "number"
        ? calc.aiDraft.confidence
        : null;
  if (raw == null || !Number.isFinite(raw)) return null;
  return raw;
}

export function calcConfidencePct(calc: CalcLike): number | null {
  const ratio = calcConfidenceRatio(calc);
  if (ratio == null) return null;
  return Math.round(ratio * 100);
}

export function classificationDisclaimer(calc: CalcLike): string {
  const raw = String(calc.aiDraft?.disclaimer || "").trim();
  if (!raw) return "";
  return raw.replace(TEST_MODE_DISCLAIMER_RE, "").replace(/\s+/g, " ").trim();
}

export function hasDraftHs(calc: CalcLike): boolean {
  const hs = String(calc.hsCodeFinal || calc.hsCode || "").trim();
  return hs.length > 0 && hs !== "—";
}

/** Draft HS is stored on create but shown only after tariff pay (lab pay-first UX). */
export function shouldRevealClientDraftHs(calc: CalcLike & { status?: string; paidAt?: string | null }): boolean {
  if (!hasDraftHs(calc)) return false;
  if (calc.paidAt) return true;
  const status = String(calc.status || "");
  if (status === "AI_READY" || status === "AWAITING_PAYMENT") return false;
  return true;
}

export function needsClassificationClarify(calc: CalcLike): boolean {
  if (!hasDraftHs(calc)) return true;
  const ratio = calcConfidenceRatio(calc);
  if (ratio == null) return false;
  return ratio < AI_CLASSIFY_LOW_CONF;
}

export function classificationWhyTitle(calc: CalcLike): string {
  return needsClassificationClarify(calc) ? "Нужно уточнение" : "Почему этот код";
}

export function classificationWhyBody(calc: CalcLike): string {
  const disclaimer = classificationDisclaimer(calc);
  if (disclaimer) return disclaimer;
  if (needsClassificationClarify(calc)) {
    return "Не хватило описания для однозначного кода. Уточните состав, материал и назначение. Финал подтверждает брокер.";
  }
  const desc = String(calc.description || "").trim();
  if (desc) {
    return "Черновик по описанию и документам. Финал подтверждает брокер.";
  }
  return "Черновик кода. Финал подтверждает брокер.";
}

export function classificationHeroKicker(calc: CalcLike, enrichPending: boolean): string {
  if (enrichPending && hasDraftHs(calc)) return "Предварительный код ТН ВЭД";
  if (hasDraftHs(calc)) return "Код ТН ВЭД ЕАЭС";
  return enrichPending ? "AI подбирает код" : "Код ещё считается";
}

export function aiRunTitle(_enrichPending: boolean, multiLine: boolean): string {
  if (multiLine) return "AI считает коды по позициям";
  return "AI подбирает код";
}
