/**
 * ETT (layer B) JSON parser — no invented rates.
 * Official dumps: ЕЭК СТНВЭДСТ / data.egov.kz. The published KZ set v3 is
 * link-only (`[{link}]`) and yields []. Card then shows rate=null.
 */
import { normalizeHsCode } from "./tnved";

export const TNVED_ETT_SOURCE = "ett-opendata";

export type EttDutyRow = {
  code: string;
  dutyKind: "AD_VALOREM" | "SPECIFIC" | "COMBINED";
  dutyPct: number | null;
  dutyRubPerUnit: number | null;
  unit: string | null;
  source: string;
  raw?: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function str(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

/** Parse "0%", "5", "5,0", "10 %" → number. Reject ranges / "см. примечание". */
export function parseEttPercent(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/\s+/g, " ").replace(",", ".");
  if (!s || /примечан|см\.|см |from |to |—|–|\.\.\./i.test(s)) return null;
  const m = s.match(/^(\d+(?:\.\d+)?)\s*%?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

export function parseEttJson(input: unknown, source = TNVED_ETT_SOURCE): EttDutyRow[] {
  const list = Array.isArray(input)
    ? input
    : asRecord(input)?.items
      ? (asRecord(input)!.items as unknown[])
      : [];
  const out: EttDutyRow[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;
    const linkOnly = Boolean(str(row, ["link"])) && !str(row, ["code", "kod", "tnved", "hs", "hsCode", "stavka", "dutyPct"]);
    if (linkOnly) continue;
    const code = normalizeHsCode(str(row, ["code", "kod", "tnved", "hs", "hsCode", "hs_code"]) || "");
    if (!code) continue;
    const rawStavka = str(row, ["stavka", "dutyPct", "rate", "advalorem", "ad_valorem", "stavka_pošliny", "stavka_poshliny"]);
    const dutyPct = parseEttPercent(rawStavka);
    if (dutyPct == null) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({
      code,
      dutyKind: "AD_VALOREM",
      dutyPct,
      dutyRubPerUnit: null,
      unit: null,
      source,
      raw: rawStavka,
    });
  }
  return out;
}
