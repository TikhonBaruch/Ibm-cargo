/**
 * Cov-P11: search/cascade S+ for top-20 new families (P7–P9 packs).
 * Canon: docs/knowledge/plan-hint-coverage-expansion.md §Cov-P11
 */
import { describe, expect, it, beforeEach } from "vitest";
import invoiceAliases from "../tnved-invoice-aliases.json";
import ftsNotes from "../tnved-fts-2026-notes.json";
import { classifyTnvedCascade } from "../tnved-classify";
import { matchClassifyAlias } from "../tnved-classify-aliases";
import { resetClassifyIndexCache } from "../tnved-classify-index";
import { notesByCodeFromLabSearch } from "../tnved-lab-catalog";
import { scoreTnvedSearchHit, tnvedSearchStems } from "../tnved";

const mockDb = {
  tnvedCode: { findUnique: async () => null, findMany: async () => [] },
} as never;

const CASCADE_GOLDEN = [
  ["рис", "1006"],
  ["макароны", "1902"],
  ["мука", "1101"],
  ["колбаса", "1601"],
  ["говядина", "0201"],
  ["рыба", "0302"],
  ["лосось", "0302"],
  ["креветки", "0306"],
  ["мёд", "0409"],
  ["орехи", "0802"],
  ["чипсы", "1905"],
  ["сок апельсиновый", "2202"],
  ["водка", "2208"],
  ["виски", "2208"],
  ["чайник", "8516"],
  ["блендер", "8509"],
  ["матрас", "9404"],
  ["нож", "8211"],
  ["стиральный порошок", "3402"],
  ["SSD", "8471"],
  ["фотоаппарат", "9006"],
  ["объектив", "9002"],
  ["моторное масло", "2710"],
  ["клей", "3506"],
  ["коляска", "8715"],
  ["ручка", "9608"],
  ["кольцо", "7113"],
  ["гитара", "9202"],
  ["сигареты", "2402"],
  ["playstation", "9504"],
  ["комбикорм", "2309"],
  ["термометр", "9025"],
  ["розетка", "8536"],
  ["бампер", "8708"],
  ["ткань", "5208"],
] as const;

const ALIAS_GOLDEN = [
  ["рис", "100630"],
  ["колбаса", "160100"],
  ["рыба", "030214"],
  ["мёд", "040900"],
  ["чипсы", "190590"],
  ["водка", "220860"],
  ["чайник", "851679"],
  ["SSD", "847170"],
  ["фотоаппарат", "900653"],
  ["моторное масло", "271019"],
  ["клей", "350610"],
  ["коляска", "871500"],
  ["ручка", "960810"],
  ["кольцо", "711319"],
  ["гитара", "920290"],
  ["сигареты", "240220"],
  ["playstation", "950450"],
  ["термометр", "902519"],
  ["розетка", "853669"],
] as const;

const SEARCH_GOLDEN = [
  ["рис", "100630", "0401"],
  ["колбаса", "160100", "0406"],
  ["рыба", "030214", "0301"],
  ["чайник", "851679", "0902"],
  ["SSD", "847170", "8517"],
  ["фотоаппарат", "900653", "8525"],
  ["моторное масло", "271019", "1507"],
  ["ручка", "960810", "0709"],
  ["гитара", "920290", "9201"],
  ["сигареты", "240220", "2403"],
  ["playstation", "950450", "8517"],
] as const;

const packed = notesByCodeFromLabSearch({
  aliases: [...invoiceAliases, ...ftsNotes],
});

function notesForCode(code: string) {
  const digits = code.replace(/\D/g, "");
  const tokens = packed.tokens.get(digits) || [];
  const why = packed.why.get(digits) || [];
  return [...tokens, ...why].join("\n");
}

describe("Cov-P11 — classify cascade S+", () => {
  beforeEach(() => {
    resetClassifyIndexCache();
  });

  it.each(CASCADE_GOLDEN)("%s → HS %s", async (q, prefix) => {
    const hit = await classifyTnvedCascade(mockDb, { description: q });
    expect(hit, q).not.toBeNull();
    expect(hit!.hsCode.replace(/\D/g, "").startsWith(prefix)).toBe(true);
    expect(hit!.confidence).toBeGreaterThanOrEqual(0.84);
  });
});

describe("Cov-P11 — classify alias S+", () => {
  it.each(ALIAS_GOLDEN)("%s → alias %s", (q, code) => {
    const hit = matchClassifyAlias(q);
    expect(hit?.alias.code, q).toBe(code);
    expect(hit!.score).toBeGreaterThanOrEqual(14);
  });
});

describe("Cov-P11 — search notes S+", () => {
  it.each(SEARCH_GOLDEN)("%s prefers %s over %s chapter", (q, goodCode, badCode) => {
    const stems = tnvedSearchStems(q);
    const good = scoreTnvedSearchHit(
      {
        code: `${goodCode}0000`.slice(0, 10),
        notes: notesForCode(goodCode),
        titleRu: "Cov-P11 golden",
        isLeaf: true,
        level: 10,
      },
      { stems, digits: "", phrase: q },
    );
    const bad = scoreTnvedSearchHit(
      {
        code: `${badCode}0000`.slice(0, 10),
        notes: "generic unrelated title",
        titleRu: "wrong chapter",
        isLeaf: true,
        level: 10,
      },
      { stems, digits: "", phrase: q },
    );
    expect(good, q).toBeGreaterThan(bad);
    expect(good).toBeGreaterThan(15);
  });
});

describe("Cov-P11 — cascade must-not guards", () => {
  beforeEach(() => {
    resetClassifyIndexCache();
  });

  it.each([
    ["рисовое молоко", "1006"],
    ["масло подсолнечное", "2710"],
    ["электронная сигарета", "2402"],
  ] as const)("%s must not cascade to %s", async (q, badPrefix) => {
    const hit = await classifyTnvedCascade(mockDb, { description: q });
    if (!hit) return;
    expect(hit.hsCode.replace(/\D/g, "").startsWith(badPrefix)).toBe(false);
  });
});
