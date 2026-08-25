/**
 * White-import estimate without international freight (D27).
 * Customs value = invoice × FX × buffer. Not CIF.
 */
export const INVOICE_CURRENCIES = ["USD", "CNY", "EUR"] as const;
export type InvoiceCurrency = (typeof INVOICE_CURRENCIES)[number];

export const DEFAULT_FX = {
  usd: 90,
  cny: 12.5,
  eur: 98,
  bufferPct: 2,
} as const;

export const LANDED_WITHOUT_FREIGHT_NOTE =
  "Без международной доставки. Таможенная стоимость = инвойс (курс с запасом). Не CIF.";

export type FxRates = {
  usd: number;
  cny: number;
  eur: number;
  bufferPct: number;
};

export type LandedWithoutFreight = {
  currency: InvoiceCurrency;
  invoiceAmount: number;
  goodsRub: number;
  bufferPct: number;
  dutyRub: number;
  vatRub: number;
  feeRub: number;
  extraFeeRub: number;
  totalPaymentsRub: number;
  landedRub: number;
  qty: number | null;
  perUnitRub: number | null;
  note: string;
};

export function isInvoiceCurrency(v: unknown): v is InvoiceCurrency {
  return v === "USD" || v === "CNY" || v === "EUR";
}

export function fxRatesFromSettings(settings?: {
  usdRate?: number;
  cnyRate?: number;
  eurRate?: number;
  fxBufferPct?: number;
} | null): FxRates {
  const buffer = settings?.fxBufferPct;
  return {
    usd: settings?.usdRate && settings.usdRate > 0 ? settings.usdRate : DEFAULT_FX.usd,
    cny: settings?.cnyRate && settings.cnyRate > 0 ? settings.cnyRate : DEFAULT_FX.cny,
    eur: settings?.eurRate && settings.eurRate > 0 ? settings.eurRate : DEFAULT_FX.eur,
    bufferPct:
      typeof buffer === "number" && Number.isFinite(buffer)
        ? Math.min(10, Math.max(0, buffer))
        : DEFAULT_FX.bufferPct,
  };
}

function parseAmountToken(raw: string): number {
  const n = Number(String(raw).replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function parseShipmentInvoice(
  raw?: string | null,
  currencyHint?: string | null
): { amount: number; currency: InvoiceCurrency } {
  const hint = isInvoiceCurrency(currencyHint?.toUpperCase())
    ? (currencyHint!.toUpperCase() as InvoiceCurrency)
    : null;
  const s = String(raw || "").trim();
  if (!s) {
    return { amount: 18_000, currency: hint || "USD" };
  }
  const prefix = s.match(/^([A-Za-z]{3})\s+(.+)$/);
  if (prefix && isInvoiceCurrency(prefix[1].toUpperCase())) {
    const amount = parseAmountToken(prefix[2]);
    return { amount: amount || 18_000, currency: prefix[1].toUpperCase() as InvoiceCurrency };
  }
  const suffix = s.match(/^(.+?)\s+([A-Za-z]{3})$/);
  if (suffix && isInvoiceCurrency(suffix[2].toUpperCase())) {
    const amount = parseAmountToken(suffix[1]);
    return { amount: amount || 18_000, currency: suffix[2].toUpperCase() as InvoiceCurrency };
  }
  const amount = parseAmountToken(s);
  return { amount: amount || 18_000, currency: hint || "USD" };
}

export function formatShipmentInvoice(amount: number, currency: InvoiceCurrency): string {
  const n = Number.isFinite(amount) ? String(amount) : "0";
  if (currency === "USD") return n;
  return `${n} ${currency}`;
}

export function invoiceToRub(
  amount: number,
  currency: InvoiceCurrency,
  rates: FxRates
): number {
  const rate = currency === "CNY" ? rates.cny : currency === "EUR" ? rates.eur : rates.usd;
  const buf = 1 + rates.bufferPct / 100;
  return Math.round(Math.max(0, amount) * rate * buf);
}

export function invoiceCustomsValue(
  shipmentValue?: string | null,
  currencyHint?: string | null,
  settings?: Parameters<typeof fxRatesFromSettings>[0]
): {
  invoice: { amount: number; currency: InvoiceCurrency };
  rates: FxRates;
  goodsRub: number;
  storedShipmentValue: string;
} {
  const invoice = parseShipmentInvoice(shipmentValue, currencyHint);
  const rates = fxRatesFromSettings(settings);
  return {
    invoice,
    rates,
    goodsRub: invoiceToRub(invoice.amount, invoice.currency, rates),
    storedShipmentValue: formatShipmentInvoice(invoice.amount, invoice.currency),
  };
}

export function sumItemQty(items?: Array<{ qty?: number | null }> | null): number | null {
  if (!items?.length) return null;
  let sum = 0;
  let any = false;
  for (const it of items) {
    if (it.qty != null && Number.isFinite(it.qty) && it.qty > 0) {
      sum += it.qty;
      any = true;
    }
  }
  return any ? sum : null;
}

export function assembleLandedWithoutFreight(opts: {
  invoiceAmount: number;
  currency: InvoiceCurrency;
  goodsRub: number;
  bufferPct: number;
  dutyRub: number;
  vatRub: number;
  feeRub: number;
  extraFeeRub?: number;
  qty?: number | null;
}): LandedWithoutFreight {
  const extraFeeRub = Math.max(0, Math.round(opts.extraFeeRub || 0));
  const dutyRub = Math.max(0, Math.round(opts.dutyRub));
  const vatRub = Math.max(0, Math.round(opts.vatRub));
  const feeRub = Math.max(0, Math.round(opts.feeRub));
  const goodsRub = Math.max(0, Math.round(opts.goodsRub));
  const totalPaymentsRub = dutyRub + vatRub + feeRub + extraFeeRub;
  const landedRub = goodsRub + totalPaymentsRub;
  const qty = opts.qty != null && opts.qty > 0 ? opts.qty : null;
  return {
    currency: opts.currency,
    invoiceAmount: opts.invoiceAmount,
    goodsRub,
    bufferPct: opts.bufferPct,
    dutyRub,
    vatRub,
    feeRub,
    extraFeeRub,
    totalPaymentsRub,
    landedRub,
    qty,
    perUnitRub: qty ? Math.round(landedRub / qty) : null,
    note: LANDED_WITHOUT_FREIGHT_NOTE,
  };
}

export function landedFromAiDraft(draft: unknown): LandedWithoutFreight | null {
  if (!draft || typeof draft !== "object") return null;
  const raw = (draft as { landedWithoutFreight?: unknown }).landedWithoutFreight;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<LandedWithoutFreight>;
  if (typeof o.goodsRub !== "number" || !isInvoiceCurrency(o.currency)) return null;
  return assembleLandedWithoutFreight({
    invoiceAmount: typeof o.invoiceAmount === "number" ? o.invoiceAmount : 0,
    currency: o.currency,
    goodsRub: o.goodsRub,
    bufferPct: typeof o.bufferPct === "number" ? o.bufferPct : DEFAULT_FX.bufferPct,
    dutyRub: typeof o.dutyRub === "number" ? o.dutyRub : 0,
    vatRub: typeof o.vatRub === "number" ? o.vatRub : 0,
    feeRub: typeof o.feeRub === "number" ? o.feeRub : 0,
    extraFeeRub: typeof o.extraFeeRub === "number" ? o.extraFeeRub : 0,
    qty: typeof o.qty === "number" ? o.qty : null,
  });
}

export function pdfLandedFields(landed: LandedWithoutFreight | null): {
  goodsRub?: number;
  landedWithoutFreightRub?: number;
  perUnitRub?: number | null;
} {
  if (!landed) return {};
  return {
    goodsRub: landed.goodsRub,
    landedWithoutFreightRub: landed.landedRub,
    perUnitRub: landed.perUnitRub,
  };
}

export function refreshLandedPayments(
  snapshot: LandedWithoutFreight | null,
  payments: {
    dutyRub: number;
    vatRub: number;
    feeRub: number;
    extraFeeRub?: number;
    qty?: number | null;
  }
): LandedWithoutFreight | null {
  if (!snapshot) return null;
  return assembleLandedWithoutFreight({
    invoiceAmount: snapshot.invoiceAmount,
    currency: snapshot.currency,
    goodsRub: snapshot.goodsRub,
    bufferPct: snapshot.bufferPct,
    dutyRub: payments.dutyRub,
    vatRub: payments.vatRub,
    feeRub: payments.feeRub,
    extraFeeRub: payments.extraFeeRub,
    qty: payments.qty !== undefined ? payments.qty : snapshot.qty,
  });
}

export function landedForCalcDisplay(calc: {
  aiDraft?: unknown;
  dutyRub?: number | null;
  vatRub?: number | null;
  feeRub?: number | null;
  extraFeeRub?: number | null;
  items?: Array<{ qty?: number | null }> | null;
}): LandedWithoutFreight | null {
  const snap = landedFromAiDraft(calc.aiDraft);
  if (!snap) return null;
  return refreshLandedPayments(snap, {
    dutyRub: calc.dutyRub ?? snap.dutyRub,
    vatRub: calc.vatRub ?? snap.vatRub,
    feeRub: calc.feeRub ?? snap.feeRub,
    extraFeeRub: calc.extraFeeRub ?? snap.extraFeeRub,
    qty: sumItemQty(calc.items) ?? snap.qty,
  });
}

export function mergeLandedIntoDraft(
  draft: unknown,
  landed: LandedWithoutFreight | null
): Record<string, unknown> {
  const base =
    draft && typeof draft === "object" && !Array.isArray(draft)
      ? { ...(draft as Record<string, unknown>) }
      : {};
  if (!landed) return base;
  return { ...base, landedWithoutFreight: landed };
}
