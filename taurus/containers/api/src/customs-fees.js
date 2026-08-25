/**
 * Shared fee/VAT constants for Node containers (keep in sync with src/lib/ved/customs-fees.ts).
 */
export const DEFAULT_IMPORT_VAT_PERCENT = 22;

const BRACKETS = [
  [200_000, 1_231],
  [450_000, 2_462],
  [1_200_000, 4_924],
  [2_700_000, 13_541],
  [4_200_000, 18_465],
  [5_500_000, 21_344],
  [10_000_000, 49_240],
];

export function customsOperationsFeeRub(customsValueRub) {
  const v = Math.max(0, Math.round(Number(customsValueRub) || 0));
  for (const [max, fee] of BRACKETS) {
    if (v <= max) return fee;
  }
  return 73_860;
}

/** Estimate fee from USD shipment when RUB customs value unknown (demo rate 90). */
export function customsOperationsFeeFromUsd(shipmentValueUsd, usdRate = 90) {
  const usd = Number(shipmentValueUsd) || 18_000;
  return customsOperationsFeeRub(Math.round(usd * usdRate));
}
