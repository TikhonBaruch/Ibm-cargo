/**
 * Cov-P17: cascade S+ polish for plan-s7 CASCADE-only rows.
 * Canon: docs/knowledge/plan-hint-gap-probe-run.md §6.5
 */
import { describe, expect, it, beforeEach } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";
import { classifyTnvedCascade } from "../tnved-classify";
import { matchClassifyAlias } from "../tnved-classify-aliases";
import { resetClassifyIndexCache } from "../tnved-classify-index";
import {
  attrSuggestIsClarifyOnly,
  heuristicAttrSuggest,
} from "../attr-suggest";

const mockDb = {
  tnvedCode: { findUnique: async () => null, findMany: async () => [] },
} as never;

const GENERIC = "уточните назначение товара";

const CASCADE_ROWS = [
  ["морс", "2202", "220290", ["snacks", "fruit-fresh"]],
  ["варежки", "6116", "611610", ["knit-top"]],
  ["HDD", "8471", "847170", ["computers", "pc-parts"]],
  ["hdmi кабель", "8544", "8544429000", ["power"]],
  ["воздушный фильтр", "8421", "8421310000", ["auto-parts"]],
  ["маслофильтр", "8421", "8421230000", ["auto-parts"]],
] as const;

function attrLayer(out: ReturnType<typeof heuristicAttrSuggest>): "A+" | "A~" | "A0" {
  if (attrSuggestIsClarifyOnly(out)) return "A~";
  if (out.attrs.hsHint) return "A+";
  if (out.attrs.purpose === GENERIC) return "A0";
  return "A+";
}

describe("Cov-P17 — CASCADE-only rows (no pack)", () => {
  it.each(CASCADE_ROWS.map((r) => [r[0], r[3]] as const))("%s pack null", (q, mustNot) => {
    const pack = matchHintPack(q)?.id ?? null;
    expect(pack, q).toBeNull();
    for (const bad of mustNot) {
      expect(pack, `${q} mustNot ${bad}`).not.toBe(bad);
    }
  });

  it.each(CASCADE_ROWS.map((r) => [r[0]] as const))("%s attr A0", (q) => {
    expect(attrLayer(heuristicAttrSuggest({ description: q })), q).toBe("A0");
  });
});

describe("Cov-P17 — classify cascade S+", () => {
  beforeEach(() => {
    resetClassifyIndexCache();
  });

  it.each(CASCADE_ROWS.map((r) => [r[0], r[1]] as const))("%s → HS %s", async (q, prefix) => {
    const hit = await classifyTnvedCascade(mockDb, { description: q });
    expect(hit, q).not.toBeNull();
    expect(hit!.hsCode.replace(/\D/g, "").startsWith(prefix)).toBe(true);
    expect(hit!.confidence).toBeGreaterThanOrEqual(0.84);
  });
});

describe("Cov-P17 — classify alias S+", () => {
  it.each(CASCADE_ROWS.map((r) => [r[0], r[2]] as const))("%s → alias %s", (q, code) => {
    const hit = matchClassifyAlias(q);
    expect(hit?.alias.code.replace(/\D/g, "").startsWith(code.replace(/\D/g, ""))).toBe(true);
    expect(hit!.score).toBeGreaterThanOrEqual(14);
  });
});
