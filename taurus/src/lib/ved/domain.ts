/**
 * Pure VED domain helpers: status transitions, payments, PDF HTML,
 * position limits (D10), shipping quote stubs, HTML escape for reports.
 */
import type { CalculationStatus, TariffCode } from "@prisma/client";
import { customsOperationsFeeRub } from "./customs-fees";

export const PLATFORM_SETTING_KEYS = {
  confidenceThreshold: "ved.confidenceThreshold",
  defaultSlaHours: "ved.defaultSlaHours",
  /** Hours preferred broker has exclusive claim before queue opens to all (default = SLA). */
  preferredClaimHours: "ved.preferredClaimHours",
  usdRate: "ved.usdRate",
  cnyRate: "ved.cnyRate",
  eurRate: "ved.eurRate",
  /** Percent added to FX when converting invoice → customs value (bot-style buffer). */
  fxBufferPct: "ved.fxBufferPct",
  marketplaceEnabled: "ved.marketplaceEnabled",
  autoAssignBrokers: "ved.autoAssignBrokers",
  maintenanceMode: "ved.maintenanceMode",
  /** Admin kill-switch: company topup + tariff pay */
  paymentsEnabled: "ved.paymentsEnabled",
  /** Admin kill-switch: external LLM enrich on draft */
  llmEnrichEnabled: "ved.llmEnrichEnabled",
  /** Admin kill-switch: outbox/notify delivery kick */
  notifyEnabled: "ved.notifyEnabled",
  /** Admin allow mock topup (AND with env ALLOW_MOCK_TOPUP / non-prod) */
  mockTopupAllowed: "ved.mockTopupAllowed",
} as const;

/** Preferred exclusive window: true while preferred broker still has exclusive claim rights. */
export function isPreferredExclusiveActive(opts: {
  preferredBrokerUserId?: string | null;
  queuedAt?: Date | string | null;
  preferredClaimHours: number;
  now?: Date;
}): boolean {
  if (!opts.preferredBrokerUserId || !opts.queuedAt) return false;
  const queued = typeof opts.queuedAt === "string" ? new Date(opts.queuedAt) : opts.queuedAt;
  const hours = Math.max(0, opts.preferredClaimHours);
  const deadline = new Date(queued.getTime() + hours * 3600_000);
  return (opts.now ?? new Date()) < deadline;
}

export type AiDraftResult = {
  hsCode: string;
  duties: {
    customsDutyPercent: number;
    vatPercent: number;
    feeRub: number;
    note?: string;
  };
  documents: string[];
  confidence: number;
  disclaimer: string;
  inputPreview?: string;
  engine?: string;
  /** Present when optional LLM enrich ran (S6). */
  llmEnrich?: string;
  /** True while BackgroundJob AI_DRAIN is running — client should wait before treating hsCode as final. */
  llmEnrichPending?: boolean;
};

export function needsBroker(tariffCode: TariffCode | null | undefined, confidence: number, threshold: number): boolean {
  if (!tariffCode || tariffCode === "EXPRESS") {
    // Express is AI-only unless confidence is below threshold
    return confidence < threshold;
  }
  return true;
}

export function canTransition(from: CalculationStatus, to: CalculationStatus): boolean {
  // Pay goes AI_READY → QUEUED|DONE directly (D8/D11). AWAITING_PAYMENT kept for legacy/UI only.
  const allowed: Record<CalculationStatus, CalculationStatus[]> = {
    DRAFT: ["AI_PROCESSING", "CANCELLED"],
    AI_PROCESSING: ["AI_READY", "CANCELLED"],
    AI_READY: ["AWAITING_PAYMENT", "QUEUED", "DONE", "CANCELLED"],
    AWAITING_PAYMENT: ["QUEUED", "DONE", "CANCELLED"],
    QUEUED: ["IN_REVIEW", "SLA_RISK", "CANCELLED"],
    IN_REVIEW: ["DONE", "SLA_RISK", "QUEUED", "CANCELLED"],
    DONE: [],
    SLA_RISK: ["IN_REVIEW", "QUEUED", "DONE", "CANCELLED"],
    CANCELLED: [],
  };
  return allowed[from]?.includes(to) ?? false;
}

/** Throws if `from → to` is not allowed by D8 / canTransition (D23). */
export function assertTransition(from: CalculationStatus, to: CalculationStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal status transition ${from} → ${to}`);
  }
}

export function nextCalculationNumber(seq: number): string {
  return `#${47800 + seq}`;
}

export function computePayments(opts: {
  shipmentValueUsd?: number;
  /** When set, used as customs value (invoice in RUB). Skips USD×rate. */
  customsValueRub?: number;
  dutyPercent: number;
  vatPercent: number;
  /** Explicit fee (broker). If omitted / `feeFromSchedule`, use PP 1637/1638 scale. */
  feeRub?: number;
  /** When true, ignore feeRub and use customs operations schedule (AI draft). */
  feeFromSchedule?: boolean;
  /** Excise Rub — included in VAT base when present (hold: usually 0). */
  exciseRub?: number;
  usdRate: number;
}) {
  const customsValueRub =
    opts.customsValueRub != null && Number.isFinite(opts.customsValueRub)
      ? Math.max(0, Math.round(opts.customsValueRub))
      : Math.round((opts.shipmentValueUsd || 18000) * opts.usdRate);
  const dutyRub = Math.round(customsValueRub * (opts.dutyPercent / 100));
  const exciseRub = Math.max(0, Math.round(opts.exciseRub || 0));
  const vatBase = customsValueRub + dutyRub + exciseRub;
  const vatRub = Math.round(vatBase * (opts.vatPercent / 100));
  const feeRub =
    opts.feeFromSchedule || opts.feeRub == null
      ? customsOperationsFeeRub(customsValueRub)
      : opts.feeRub;
  const totalPaymentsRub = dutyRub + vatRub + feeRub;
  return { customsValueRub, dutyRub, vatRub, feeRub, totalPaymentsRub, exciseRub };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function maxPositionsForTariff(code: TariffCode | null | undefined): number {
  if (code === "PRO") return 10;
  if (code === "STANDARD") return 3;
  return 1; // EXPRESS — one line item
}

export function sanitizeBrokerItemDescription(raw?: string | null): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  return t.slice(0, 5000);
}

/** Extra fees on the estimate — not platform tariff. Note required when amount > 0. */
export function normalizeBrokerExtraFee(opts: {
  extraFeeRub?: number | null;
  extraFeeNote?: string | null;
}): { extraFeeRub: number; extraFeeNote: string | null } {
  const extraFeeRub = Math.max(0, Math.round(Number(opts.extraFeeRub) || 0));
  const extraFeeNote = (opts.extraFeeNote ?? "").trim().slice(0, 500) || null;
  if (extraFeeRub > 0 && !extraFeeNote) {
    throw new Error("Укажите, за что прочие сборы");
  }
  return { extraFeeRub, extraFeeNote: extraFeeRub > 0 ? extraFeeNote : null };
}

export function sumItemPayments(
  items: Array<{ dutyRub?: number | null; vatRub?: number | null }>,
  feeRub: number,
  extraFeeRub = 0
) {
  const dutyRub = items.reduce((s, i) => s + (i.dutyRub ?? 0), 0);
  const vatRub = items.reduce((s, i) => s + (i.vatRub ?? 0), 0);
  const extra = Math.max(0, Math.round(extraFeeRub || 0));
  return {
    dutyRub,
    vatRub,
    feeRub,
    extraFeeRub: extra,
    totalPaymentsRub: dutyRub + vatRub + feeRub + extra,
  };
}

export type ShippingQuoteStub = {
  id: string;
  mode: string;
  etaDays: number;
  priceRub: number;
  carrierLabel: string;
  selected?: boolean;
};

export function buildStubShippingQuotes(opts: {
  origin: string;
  destination: string;
  preferredMode?: string;
}): ShippingQuoteStub[] {
  const base = 45000 + (opts.origin.length + opts.destination.length) * 120;
  const quotes: ShippingQuoteStub[] = [
    {
      id: "q_lcl",
      mode: "LCL",
      etaDays: 28,
      priceRub: Math.round(base * 0.85),
      carrierLabel: "SilkWay LCL",
    },
    {
      id: "q_fcl",
      mode: "FCL",
      etaDays: 22,
      priceRub: Math.round(base * 1.35),
      carrierLabel: "EastImport FCL 40'",
    },
    {
      id: "q_air",
      mode: "AIR",
      etaDays: 5,
      priceRub: Math.round(base * 2.1),
      carrierLabel: "AeroCargo Express",
    },
  ];
  const pref = opts.preferredMode?.toUpperCase();
  return quotes.map((q) => ({
    ...q,
    selected: pref ? q.mode === pref : q.mode === "LCL",
  }));
}

export function buildPdfHtml(calc: {
  number: string;
  title: string;
  hsCode?: string | null;
  hsCodeFinal?: string | null;
  dutyRub?: number | null;
  vatRub?: number | null;
  feeRub?: number | null;
  extraFeeRub?: number | null;
  extraFeeNote?: string | null;
  totalPaymentsRub?: number | null;
  goodsRub?: number | null;
  landedWithoutFreightRub?: number | null;
  perUnitRub?: number | null;
  confidence?: number | null;
  brokerComment?: string | null;
  disclaimer?: string;
  items?: Array<{
    name: string;
    description?: string | null;
    hsCodeFinal?: string | null;
    hsCodeAi?: string | null;
    dutyRub?: number | null;
    vatRub?: number | null;
  }>;
}): string {
  const code = escapeHtml(calc.hsCodeFinal || calc.hsCode || "—");
  const title = escapeHtml(calc.title);
  const number = escapeHtml(calc.number);
  const comment = calc.brokerComment ? escapeHtml(calc.brokerComment) : null;
  const disclaimer = escapeHtml(
    calc.disclaimer || "Рекомендация AI. Финальное решение — брокер или клиент."
  );
  const itemRows =
    calc.items && calc.items.length > 0
      ? calc.items
          .map((it) => {
            const hs = escapeHtml(it.hsCodeFinal || it.hsCodeAi || "—");
            const name = escapeHtml(it.name);
            const desc = it.description
              ? `<div class="muted">${escapeHtml(it.description)}</div>`
              : "";
            return `<tr><td>${name}${desc}</td><td>${hs}</td><td>${(it.dutyRub ?? 0).toLocaleString("ru-RU")} ₽</td><td>${(it.vatRub ?? 0).toLocaleString("ru-RU")} ₽</td></tr>`;
          })
          .join("")
      : "";
  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"/><title>Отчёт ${number}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;color:#0f172a}
h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:16px}
td,th{border:1px solid #e2e8f0;padding:8px 10px;text-align:left}
.muted{color:#64748b;font-size:13px;margin-top:24px}</style></head>
<body>
<h1>LBM Брокер — отчёт ${number}</h1>
<p><strong>${title}</strong></p>
<table>
<tr><th>Код ТН ВЭД</th><td>${code}</td></tr>
${
  calc.goodsRub != null
    ? `<tr><th>Товар (инвойс)</th><td>${calc.goodsRub.toLocaleString("ru-RU")} ₽</td></tr>`
    : ""
}
<tr><th>Пошлина</th><td>${(calc.dutyRub ?? 0).toLocaleString("ru-RU")} ₽</td></tr>
<tr><th>НДС</th><td>${(calc.vatRub ?? 0).toLocaleString("ru-RU")} ₽</td></tr>
<tr><th>Сбор</th><td>${(calc.feeRub ?? 0).toLocaleString("ru-RU")} ₽</td></tr>
${
  (calc.extraFeeRub ?? 0) > 0
    ? `<tr><th>Прочие сборы</th><td>${(calc.extraFeeRub ?? 0).toLocaleString("ru-RU")} ₽${
        calc.extraFeeNote ? ` · ${escapeHtml(calc.extraFeeNote)}` : ""
      }</td></tr>`
    : ""
}
<tr><th>Итого платежей</th><td><strong>${(calc.totalPaymentsRub ?? 0).toLocaleString("ru-RU")} ₽</strong></td></tr>
${
  calc.landedWithoutFreightRub != null
    ? `<tr><th>Итого без доставки</th><td><strong>${calc.landedWithoutFreightRub.toLocaleString("ru-RU")} ₽</strong></td></tr>`
    : ""
}
${
  calc.perUnitRub != null
    ? `<tr><th>На единицу</th><td>${calc.perUnitRub.toLocaleString("ru-RU")} ₽</td></tr>`
    : ""
}
<tr><th>Confidence</th><td>${calc.confidence != null ? Math.round(calc.confidence * 100) + "%" : "—"}</td></tr>
</table>
${
  itemRows
    ? `<h2>Сопоставление позиций</h2><table><tr><th>Позиция</th><th>ТН ВЭД</th><th>Пошлина</th><th>НДС</th></tr>${itemRows}</table>`
    : ""
}
${comment ? `<p><strong>Комментарий брокера:</strong> ${comment}</p>` : ""}
<p class="muted">${disclaimer}</p>
</body></html>`;
}
