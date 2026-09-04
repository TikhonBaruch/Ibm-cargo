/**
 * Cov-P17: cascade S+ polish — auto filters promoted in C21 auto residual.
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

/** Phase C/E + auto residual: promoted from CASCADE → pack. */
const PROMOTED = [
  ["морс", "snacks", "2202", "220290"],
  ["HDD", "pc-parts", "8471", "847170"],
  ["hdmi кабель", "power", "8544", "8544429000"],
  ["воздушный фильтр", "auto-parts", "8421", "8421310000"],
  ["маслофильтр", "auto-parts", "8421", "8421230000"],
] as const;

function attrLayer(out: ReturnType<typeof heuristicAttrSuggest>): "A+" | "A~" | "A0" {
  if (attrSuggestIsClarifyOnly(out)) return "A~";
  if (out.attrs.hsHint) return "A+";
  if (out.attrs.purpose === GENERIC) return "A0";
  return "A+";
}

describe("Cov-P17 — promoted packs (food/elec/auto)", () => {
  it.each(PROMOTED)("%s → %s", (q, packId) => {
    expect(matchHintPack(q)?.id).toBe(packId);
    expect(attrLayer(heuristicAttrSuggest({ description: q }))).toBe("A~");
  });

  it("bare фильтр stays POLICY null", () => {
    expect(matchHintPack("фильтр")).toBeNull();
  });

  it("F5: варежки → gloves-scarves (was CASCADE)", () => {
    expect(matchHintPack("варежки")?.id).toBe("gloves-scarves");
    expect(attrLayer(heuristicAttrSuggest({ description: "варежки" }))).toBe("A~");
  });
});

describe("Cov-P17 — classify cascade S+", () => {
  beforeEach(() => {
    resetClassifyIndexCache();
  });

  it.each(PROMOTED.map((r) => [r[0], r[2]] as const))("%s → HS %s", async (q, prefix) => {
    const hit = await classifyTnvedCascade(mockDb, { description: q });
    expect(hit, q).not.toBeNull();
    expect(hit!.hsCode.replace(/\D/g, "").startsWith(prefix)).toBe(true);
    expect(hit!.confidence).toBeGreaterThanOrEqual(0.84);
  });
});

describe("Cov-P17 — classify alias S+", () => {
  it.each(PROMOTED.map((r) => [r[0], r[3]] as const))("%s → alias %s", (q, code) => {
    const hit = matchClassifyAlias(q);
    expect(hit?.alias.code.replace(/\D/g, "").startsWith(code.replace(/\D/g, ""))).toBe(true);
    expect(hit!.score).toBeGreaterThanOrEqual(14);
  });
});
