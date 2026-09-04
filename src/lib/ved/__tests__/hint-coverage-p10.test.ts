/**
 * Cov-P10: attr-suggest RULE parity — no silent generic when pack or apparel RULE applies.
 * Canon: docs/knowledge/plan-hint-coverage-expansion.md §Cov-P10
 */
import { describe, expect, it } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";
import {
  attrSuggestHasChips,
  attrSuggestIsClarifyOnly,
  heuristicAttrSuggest,
} from "../attr-suggest";

const GENERIC = "уточните назначение товара";

function isAttrGap(query: string, policyGeneric = false): boolean {
  if (policyGeneric) return false;
  const attr = heuristicAttrSuggest({ description: query });
  const pack = matchHintPack(query)?.id ?? null;
  const generic = attr.attrs.purpose === GENERIC;
  const helped = Boolean(attr.attrs.hsHint || attrSuggestIsClarifyOnly(attr) || !generic);
  return !pack && !helped ? true : generic && !pack && !attr.attrs.hsHint;
}

describe("Cov-P10 — apparel packs (F5, was ATTR-only)", () => {
  it.each([
    ["носки", "hosiery", /6115/],
    ["колготки", "hosiery", /6115/],
    ["куртка", "outerwear", /6201/],
    ["пальто", "outerwear", /6201/],
    ["пуховик", "outerwear", /6201/],
    ["жилет", "outerwear", /6201/],
    ["платье", "dresses", /6104/],
    ["перчатки", "gloves-scarves", /6116/],
    ["шарф", "gloves-scarves", /6117/],
    ["костюм", "suits", /6203/],
    ["бельё", "underwear-sleep", /6108/],
    ["трусы", "underwear-sleep", /6108/],
  ] as const)("%s → pack %s + clarify hs %s", (q, packId, hsRe) => {
    expect(matchHintPack(q)?.id).toBe(packId);
    const out = heuristicAttrSuggest({ description: q });
    expect(attrSuggestIsClarifyOnly(out)).toBe(true);
    expect(out.attrs.extra?.clarifyPack).toBe(packId);
    expect(out.attrs.hsHint || "").toMatch(hsRe);
  });
});

describe("Cov-P10 — clarify-only bridge when C21 pack matches", () => {
  it.each([
    ["рис", "grains-pasta"],
    ["колбаса", "meat"],
    ["рыба", "fish-seafood"],
    ["чайник", "small-appliances"],
    ["SSD", "pc-parts"],
    ["моторное масло", "auto-fluids"],
    ["ручка", "stationery"],
    ["гитара", "musical"],
    ["сигареты", "tobacco"],
  ] as const)("%s pack %s → clarify-only attr", (q, packId) => {
    expect(matchHintPack(q)?.id).toBe(packId);
    const out = heuristicAttrSuggest({ description: q });
    expect(attrSuggestIsClarifyOnly(out)).toBe(true);
    expect(out.attrs.extra?.clarifyPack).toBe(packId);
    expect(out.attrs.purpose).not.toBe(GENERIC);
    expect(out.notes.join(" ")).not.toMatch(/Добавьте состав, материал или тип/);
  });
});

describe("Cov-P10 — dual-layer regressions", () => {
  it.each([
    ["огурец", "produce-fresh"],
    ["молоко", "milk"],
    ["кеды", "footwear"],
    ["ноутбук", "computers"],
    ["кепка", "headgear"],
  ] as const)("%s stays on dedicated RULE or pack path", (q, packOrHint) => {
    const out = heuristicAttrSuggest({ description: q });
    expect(attrSuggestHasChips(out)).toBe(true);
    expect(out.attrs.purpose).not.toBe(GENERIC);
    if (packOrHint === "produce-fresh") {
      expect(attrSuggestIsClarifyOnly(out)).toBe(true);
    }
  });
});

describe("Cov-P10 — POLICY bare tokens stay generic", () => {
  it.each(["провод", "камера", "фильтр", "свеча", "перец"] as const)("%s → generic attr OK", (q) => {
    expect(matchHintPack(q)).toBeNull();
    const out = heuristicAttrSuggest({ description: q });
    expect(out.attrs.purpose).toBe(GENERIC);
    expect(isAttrGap(q, true)).toBe(false);
  });
});

describe("Cov-P10 — ATTR-GAP matrix", () => {
  const matrix = [
    "носки", "колготки", "куртка", "пальто", "пуховик", "платье", "перчатки", "шарф", "костюм", "бельё", "трусы", "жилет",
    "рис", "колбаса", "рыба", "чайник", "SSD", "моторное масло", "ручка", "гитара", "сигареты",
    "огурец", "молоко", "кеды", "ноутбук", "кепка",
  ] as const;

  it("no ATTR-GAP on golden matrix", () => {
    const gaps: string[] = [];
    for (const q of matrix) {
      const attr = heuristicAttrSuggest({ description: q });
      const generic = attr.attrs.purpose === GENERIC;
      const ok = attr.attrs.hsHint || attrSuggestIsClarifyOnly(attr) || !generic;
      if (!ok) gaps.push(q);
    }
    expect(gaps).toEqual([]);
  });
});
