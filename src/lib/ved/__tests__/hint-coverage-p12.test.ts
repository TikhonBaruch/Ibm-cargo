/**
 * Cov-P12: offline V8 pre-flight — master probe dictionary (pack / attr / cascade).
 * Live H6/H7 checklist: docs/knowledge/staging.md §Cov
 * Canon: docs/knowledge/plan-hint-coverage-expansion.md §Cov-P12
 */
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it, beforeEach } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";
import {
  attrSuggestIsClarifyOnly,
  heuristicAttrSuggest,
} from "../attr-suggest";
import { classifyTnvedCascade } from "../tnved-classify";
import { resetClassifyIndexCache } from "../tnved-classify-index";

type DictRow = {
  id: string;
  query: string;
  phase: string;
  expected: {
    pack: string | null;
    attr: "A+" | "A~" | "A0";
    searchPrefix: string | null;
  };
  mustNotPack?: string[];
  live?: boolean;
  notes?: string;
};

const dictionary = JSON.parse(
  readFileSync(path.join(__dirname, "hint-coverage-probe-dictionary.json"), "utf8"),
) as { packCount: number; rows: DictRow[] };

const GENERIC = "уточните назначение товара";

const mockDb = {
  tnvedCode: { findUnique: async () => null, findMany: async () => [] },
} as never;

/** P12 prefixes may list alternatives (`610|6210`); do not strip `|` as a digit gap. */
function hsPrefixMatches(hsCode: string, prefixSpec: string): boolean {
  const digits = hsCode.replace(/\D/g, "");
  return prefixSpec.split("|").some((part) => {
    const want = part.replace(/\D/g, "");
    return want.length > 0 && digits.startsWith(want);
  });
}

describe("Cov-P12 — hsPrefixMatches", () => {
  it("treats | as alternatives, not stripped digits", () => {
    expect(hsPrefixMatches("6107 21 000 0", "610|6210")).toBe(true);
    expect(hsPrefixMatches("6210 10 000 0", "610|6210")).toBe(true);
    expect(hsPrefixMatches("6201 11 000 0", "610|6210")).toBe(false);
  });

  it("keeps juice on 2202, not 2009", () => {
    expect(hsPrefixMatches("2202 90 000 0", "2202")).toBe(true);
    expect(hsPrefixMatches("2202 90 000 0", "2009")).toBe(false);
  });
});

function attrLayer(out: ReturnType<typeof heuristicAttrSuggest>): "A+" | "A~" | "A0" {
  if (attrSuggestIsClarifyOnly(out)) return "A~";
  if (out.attrs.hsHint) return "A+";
  if (out.attrs.purpose === GENERIC) return "A0";
  return "A+";
}

describe("Cov-P12 — master dictionary pack matrix", () => {
  it(`covers ${dictionary.rows.length} rows at packCount ${dictionary.packCount}`, () => {
    expect(dictionary.rows.length).toBeGreaterThanOrEqual(45);
    expect(dictionary.packCount).toBe(78);
  });

  it.each(dictionary.rows.map((r) => [r.id, r] as const))("%s pack", (_id, row) => {
    const pack = matchHintPack(row.query)?.id ?? null;
    expect(pack, row.query).toBe(row.expected.pack);
    for (const bad of row.mustNotPack || []) {
      expect(pack, `${row.query} mustNot ${bad}`).not.toBe(bad);
    }
  });
});

describe("Cov-P12 — master dictionary attr layer", () => {
  it.each(dictionary.rows.map((r) => [r.id, r] as const))("%s attr %s", (_id, row) => {
    const out = heuristicAttrSuggest({ description: row.query });
    expect(attrLayer(out), row.query).toBe(row.expected.attr);
  });
});

describe("Cov-P12 — master dictionary cascade S+", () => {
  beforeEach(() => {
    resetClassifyIndexCache();
  });

  const withSearch = dictionary.rows.filter((r) => r.expected.searchPrefix);

  it.each(withSearch.map((r) => [r.id, r] as const))("%s → %s", async (_id, row) => {
    const hit = await classifyTnvedCascade(mockDb, { description: row.query });
    expect(hit, row.query).not.toBeNull();
    expect(
      hsPrefixMatches(hit!.hsCode, row.expected.searchPrefix!),
      `${row.query} → ${hit!.hsCode}`,
    ).toBe(true);
  });
});

describe("Cov-P12 — live subset marked", () => {
  it("has ≥15 live probes for staging §Cov", () => {
    const live = dictionary.rows.filter((r) => r.live);
    expect(live.length).toBeGreaterThanOrEqual(15);
  });
});

describe("Cov-P12 — full household corpus (observe, not golden)", () => {
  const corpus = JSON.parse(
    readFileSync(path.join(__dirname, "hint-coverage-full-corpus.json"), "utf8"),
  ) as {
    rows: Array<{ query: string; source: string; policy: boolean; wantPack: string | null }>;
  };

  it("has ≥380 unique household+precision queries", () => {
    const keys = new Set(corpus.rows.map((r) => r.query.toLowerCase()));
    expect(corpus.rows.length).toBeGreaterThanOrEqual(380);
    expect(keys.size).toBe(corpus.rows.length);
  });

  it("plan-s7 household block is the coverage denominator", () => {
    const household = corpus.rows.filter((r) => r.source === "plan-s7");
    expect(household.length).toBeGreaterThanOrEqual(350);
    expect(household.filter((r) => r.policy).length).toBeGreaterThanOrEqual(8);
  });
});

describe("Cov-P12 — miss-log regressions (closed STEAL)", () => {
  it.each([
    ["лимонад", "beverages", "fruit-fresh"],
    ["кофемашина", "appliances", "tea-coffee"],
    ["автокресло", "baby", "furniture"],
    ["стиральный порошок", "cleaning", "appliances"],
    ["сок апельсиновый", "snacks", "fruit-fresh"],
    ["электронная сигарета", "vape", "tobacco"],
    ["playstation", "gaming", "toys"],
    ["инвалидная коляска", "med-devices", "baby-gear"],
  ] as const)("%s → %s not %s", (q, want, steal) => {
    expect(matchHintPack(q)?.id).toBe(want);
    expect(matchHintPack(q)?.id).not.toBe(steal);
  });
});
