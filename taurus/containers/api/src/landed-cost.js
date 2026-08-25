/**
 * White-import estimate without international freight.
 * Keep in sync with src/lib/ved/landed-cost.ts.
 */
export const DEFAULT_FX = { usd: 90, cny: 12.5, eur: 98, bufferPct: 2 };
export const LANDED_WITHOUT_FREIGHT_NOTE =
  "Без международной доставки. Таможенная стоимость = инвойс (курс с запасом). Не CIF.";

export function isInvoiceCurrency(v) {
  return v === "USD" || v === "CNY" || v === "EUR";
}

export function fxRatesFromSettings(settings) {
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

function parseAmountToken(raw) {
  const n = Number(String(raw).replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function parseShipmentInvoice(raw, currencyHint) {
  const hint = isInvoiceCurrency(String(currencyHint || "").toUpperCase())
    ? String(currencyHint).toUpperCase()
    : null;
  const s = String(raw || "").trim();
  if (!s) return { amount: 18_000, currency: hint || "USD" };
  const prefix = s.match(/^([A-Za-z]{3})\s+(.+)$/);
  if (prefix && isInvoiceCurrency(prefix[1].toUpperCase())) {
    const amount = parseAmountToken(prefix[2]);
    return { amount: amount || 18_000, currency: prefix[1].toUpperCase() };
  }
  const suffix = s.match(/^(.+?)\s+([A-Za-z]{3})$/);
  if (suffix && isInvoiceCurrency(suffix[2].toUpperCase())) {
    const amount = parseAmountToken(suffix[1]);
    return { amount: amount || 18_000, currency: suffix[2].toUpperCase() };
  }
  const amount = parseAmountToken(s);
  return { amount: amount || 18_000, currency: hint || "USD" };
}

export function formatShipmentInvoice(amount, currency) {
  const n = Number.isFinite(amount) ? String(amount) : "0";
  if (currency === "USD") return n;
  return `${n} ${currency}`;
}

export function invoiceToRub(amount, currency, rates) {
  const rate = currency === "CNY" ? rates.cny : currency === "EUR" ? rates.eur : rates.usd;
  const buf = 1 + rates.bufferPct / 100;
  return Math.round(Math.max(0, amount) * rate * buf);
}

export function invoiceCustomsValue(shipmentValue, currencyHint, settings) {
  const invoice = parseShipmentInvoice(shipmentValue, currencyHint);
  const rates = fxRatesFromSettings(settings);
  return {
    invoice,
    rates,
    goodsRub: invoiceToRub(invoice.amount, invoice.currency, rates),
    storedShipmentValue: formatShipmentInvoice(invoice.amount, invoice.currency),
  };
}

export function sumItemQty(items) {
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

export function assembleLandedWithoutFreight(opts) {
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

export function landedFromAiDraft(draft) {
  if (!draft || typeof draft !== "object") return null;
  const raw = draft.landedWithoutFreight;
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.goodsRub !== "number" || !isInvoiceCurrency(raw.currency)) return null;
  return assembleLandedWithoutFreight({
    invoiceAmount: typeof raw.invoiceAmount === "number" ? raw.invoiceAmount : 0,
    currency: raw.currency,
    goodsRub: raw.goodsRub,
    bufferPct: typeof raw.bufferPct === "number" ? raw.bufferPct : DEFAULT_FX.bufferPct,
    dutyRub: typeof raw.dutyRub === "number" ? raw.dutyRub : 0,
    vatRub: typeof raw.vatRub === "number" ? raw.vatRub : 0,
    feeRub: typeof raw.feeRub === "number" ? raw.feeRub : 0,
    extraFeeRub: typeof raw.extraFeeRub === "number" ? raw.extraFeeRub : 0,
    qty: typeof raw.qty === "number" ? raw.qty : null,
  });
}

export function refreshLandedPayments(snapshot, payments) {
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

export function mergeLandedIntoDraft(draft, landed) {
  const base = draft && typeof draft === "object" && !Array.isArray(draft) ? { ...draft } : {};
  if (!landed) return base;
  return { ...base, landedWithoutFreight: landed };
}
