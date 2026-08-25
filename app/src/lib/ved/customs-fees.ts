/**
 * Import VAT default + customs operations fee schedule (RF PP 1637 as amended by 1638, from 2026-01-01).
 * Canon: docs/knowledge/customs-payments.md
 */
export const DEFAULT_IMPORT_VAT_PERCENT = 22;

/** Brackets: max customs value Rub (inclusive) → fee Rub. Last sentinel = Infinity. */
export const CUSTOMS_OPERATIONS_FEE_BRACKETS_2026: ReadonlyArray<{
  maxCustomsValueRub: number;
  feeRub: number;
}> = [
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
export function customsOperationsFeeRub(customsValueRub: number): number {
  const v = Math.max(0, Math.round(Number(customsValueRub) || 0));
  for (const row of CUSTOMS_OPERATIONS_FEE_BRACKETS_2026) {
    if (v <= row.maxCustomsValueRub) return row.feeRub;
  }
  return 73_860;
}
