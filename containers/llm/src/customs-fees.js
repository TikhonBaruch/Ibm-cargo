/**
 * Shared fee/VAT constants for Node containers (keep in sync with src/lib/ved/customs-fees.ts).
 * Canon: docs/knowledge/customs-payments.md · dual-path-parity.md
 */
export const DEFAULT_IMPORT_VAT_PERCENT = 22;

/** Brackets: max customs value Rub (inclusive) → fee Rub. Last sentinel = Infinity. */
export const CUSTOMS_OPERATIONS_FEE_BRACKETS_2026 = [
  { maxCustomsValueRub: 200_000, feeRub: 1_231 },
  { maxCustomsValueRub: 450_000, feeRub: 2_462 },
  { maxCustomsValueRub: 1_200_000, feeRub: 4_924 },
  { maxCustomsValueRub: 2_700_000, feeRub: 13_541 },
  { maxCustomsValueRub: 4_200_000, feeRub: 18_465 },
  { maxCustomsValueRub: 5_500_000, feeRub: 21_344 },
  { maxCustomsValueRub: 10_000_000, feeRub: 49_240 },
  { maxCustomsValueRub: Number.POSITIVE_INFINITY, feeRub: 73_860 },
];

/** Таможенный сбор за операции выпуска ввозимых товаров (шкала 2026). */
export function customsOperationsFeeRub(customsValueRub) {
  const v = Math.max(0, Math.round(Number(customsValueRub) || 0));
  for (const row of CUSTOMS_OPERATIONS_FEE_BRACKETS_2026) {
    if (v <= row.maxCustomsValueRub) return row.feeRub;
  }
  return 73_860;
}

/** Estimate fee from USD shipment when RUB customs value unknown (demo rate 90). */
export function customsOperationsFeeFromUsd(shipmentValueUsd, usdRate = 90) {
  const usd = Number(shipmentValueUsd) || 18_000;
  return customsOperationsFeeRub(Math.round(usd * usdRate));
}
