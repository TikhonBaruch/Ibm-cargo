/**
 * Layer G: excise / recycling fee / NTM *triggers* from official NPA prefixes.
 * Not a rate table. Not Alta/TKS. Canon: customs-payments.md · plan-tnved-opendata-card.md
 */
import overlayJson from "./tnved-layer-g.json";

export type LayerGFlag = "excisePossible" | "utilSborPossible" | "ntmPossible";

export type LayerGHit = {
  flag: LayerGFlag;
  source: string;
  url: string | null;
  prefix: string;
};

type OverlayFile = {
  asOf?: string;
  rules: Array<{
    flag: LayerGFlag;
    source: string;
    url?: string | null;
    prefixes: string[];
  }>;
};

const overlay = overlayJson as OverlayFile;

export const TNVED_LAYER_G_AS_OF = overlay.asOf || "2026-01-01";

/** Longest-prefix wins per flag. */
export function matchLayerG(code: string | null | undefined): LayerGHit[] {
  const digits = String(code || "").replace(/\D/g, "");
  if (digits.length < 2) return [];
  const hits: LayerGHit[] = [];
  const seen = new Set<LayerGFlag>();
  for (const rule of overlay.rules) {
    if (seen.has(rule.flag)) continue;
    const prefixes = [...rule.prefixes].sort((a, b) => b.length - a.length);
    const prefix = prefixes.find((p) => digits.startsWith(p));
    if (!prefix) continue;
    seen.add(rule.flag);
    hits.push({
      flag: rule.flag,
      source: rule.source,
      url: rule.url ?? null,
      prefix,
    });
  }
  return hits;
}

export function layerGToHint(hits: LayerGHit[]) {
  return {
    excisePossible: hits.some((h) => h.flag === "excisePossible"),
    utilSborPossible: hits.some((h) => h.flag === "utilSborPossible"),
    ntmPossible: hits.some((h) => h.flag === "ntmPossible"),
    hits,
  };
}
