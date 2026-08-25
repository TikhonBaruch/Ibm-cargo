/**
 * Overlay third-party TWS leaf duties onto the FNS tree.
 * Not EEC NSI — source stays `tws-csv` until СТНВЭДСТ is available.
 */
import { DEFAULT_IMPORT_VAT_PERCENT } from "./customs-fees";
import type { TnvedDutyRateInput } from "./tnved";

export const TNVED_TWS_RATE_SOURCE = "tws-csv";

export type TwsCorpusDuty = {
  code?: string;
  isLeaf?: boolean;
  duty?: {
    dutyKind?: string | null;
    dutyPct?: number | null;
    note?: string | null;
    specificUnit?: string | null;
    source?: string | null;
  } | null;
};

export type OverlayableNode = {
  code: string;
  isLeaf?: boolean;
  notes?: string | null;
  rate?: TnvedDutyRateInput;
};

export function mapTwsDutyKind(
  kind: string | null | undefined
): TnvedDutyRateInput["dutyKind"] {
  const k = String(kind || "").toUpperCase();
  if (k === "SPECIFIC") return "SPECIFIC";
  if (k === "MIXED" || k === "COMBINED") return "COMBINED";
  return "AD_VALOREM";
}

function digits(code: string | undefined): string {
  return String(code || "").replace(/\D/g, "");
}

export function overlayTwsDuties<T extends OverlayableNode>(
  nodes: T[],
  corpus: TwsCorpusDuty[]
): { nodes: T[]; overlayed: number; withPct: number } {
  const byCode = new Map<string, TwsCorpusDuty>();
  for (const row of corpus) {
    const code = digits(row.code);
    if (code.length !== 10) continue;
    if (!row.duty) continue;
    byCode.set(code, row);
  }

  let overlayed = 0;
  let withPct = 0;
  const out = nodes.map((node) => {
    if (!node.isLeaf) return node;
    const hit = byCode.get(digits(node.code));
    const duty = hit?.duty;
    if (!duty) return node;
    const dutyPct =
      duty.dutyPct != null && Number.isFinite(Number(duty.dutyPct))
        ? Number(duty.dutyPct)
        : null;
    const unitRaw = String(duty.specificUnit || duty.note || "").trim();
    const rate: TnvedDutyRateInput = {
      code: digits(node.code),
      dutyKind: mapTwsDutyKind(duty.dutyKind),
      dutyPct,
      vatPct: DEFAULT_IMPORT_VAT_PERCENT,
      unit: unitRaw ? unitRaw.slice(0, 32) : null,
      source: TNVED_TWS_RATE_SOURCE,
    };
    overlayed += 1;
    if (dutyPct != null) withPct += 1;
    const note = String(duty.note || "").trim();
    const tariffLine = note ? `Тариф (TWS): ${note}` : null;
    const cleaned = String(node.notes || "")
      .replace(/\n?Тариф \(TWS\):[^\n]*/g, "")
      .trim();
    const notes = [cleaned || null, tariffLine].filter(Boolean).join("\n").slice(0, 4000) || null;
    return { ...node, rate, notes };
  });
  return { nodes: out, overlayed, withPct };
}
