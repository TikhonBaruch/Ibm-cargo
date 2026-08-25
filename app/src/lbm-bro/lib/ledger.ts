import type { HistoryItem } from "./types";

export function historyDelta(item: HistoryItem) {
  if (typeof item.amount === "number" && Number.isFinite(item.amount)) return item.amount;
  const m = item.text.match(/([+\-−])\s*([\d\s\u00a0]+)/);
  if (!m) return 0;
  const n = Number(m[2].replace(/[\s\u00a0]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return m[1] === "+" ? n : -n;
}

export function ledgerSums(history: HistoryItem[]) {
  let spent = 0;
  let added = 0;
  for (const row of history) {
    const d = historyDelta(row);
    if (d < 0) spent += -d;
    else if (d > 0) added += d;
  }
  return { spent, added };
}
