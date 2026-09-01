/**
 * Critical household queries: кепка / молоко / кеды / кроссовки.
 * Search stems, classify aliases, C21 packs, attr-suggest must not cross-steal chapters.
 */
import { describe, expect, it } from "vitest";
import { getClarificationQuestions } from "@/lbm-bro/lib/clarify-ai";
import { wizardDraftForClarify, hsHintFromClarify } from "@/components/ved/client/new-calc-clarify";
import { heuristicAttrSuggest } from "@/lib/ved/attr-suggest";
import { filterFieldSuggestions } from "@/lib/ved/field-suggest";
import { matchClassifyAlias } from "@/lib/ved/tnved-classify-aliases";
import { matchHintPack, hintTreeQuestions } from "@/lib/ved/tnved-hint-trees";
import { scoreTnvedSearchHit, tnvedSearchStems } from "@/lib/ved/tnved";

describe("critical HS reliability — stems", () => {
  it("кепка stems to кепк so notes «кепки» match", () => {
    expect(tnvedSearchStems("кепка")).toEqual(expect.arrayContaining(["кепка", "кепк"]));
    expect(tnvedSearchStems("шапка")).toEqual(expect.arrayContaining(["шапка", "шапк"]));
    const score = scoreTnvedSearchHit(
      { code: "6505003000", notes: "фуражки, кепки, козырьками", isLeaf: true, level: 10 },
      { stems: tnvedSearchStems("кепка"), digits: "", phrase: "кепка" },
    );
    expect(score).toBeGreaterThan(20);
  });
});

describe("critical HS reliability — classify aliases", () => {
  it.each([
    ["кепка", "6505003000"],
    ["бейсболка", "6505003000"],
    ["шапка", "6505009000"],
    ["молоко", "0401"],
    ["сухое молоко", "040210"],
    ["кеды", "6404110000"],
    ["кроссовки", "6404110000"],
    ["кеды текстиль", "6404110000"],
    ["огурец", "0707"],
    ["огурцы", "0707"],
    ["помидор", "0702"],
    ["маринованные огурцы", "2001"],
    ["корнишоны", "2001"],
  ] as const)("%s → %s", (q, code) => {
    const hit = matchClassifyAlias(q);
    expect(hit?.alias.code, q).toBe(code);
    expect(hit!.score).toBeGreaterThanOrEqual(14);
  });

  it("сухое молоко does not stick on 0401", () => {
    expect(matchClassifyAlias("сухое молоко")?.alias.code).toBe("040210");
    expect(matchClassifyAlias("йогурт")?.alias.code).toBe("0403");
  });
});

describe("critical HS reliability — C21 + clarify", () => {
  it("кепка → headgear pack → 6505003000 chip", async () => {
    expect(matchHintPack("кепка")?.id).toBe("headgear");
    const qs = await getClarificationQuestions({
      wizard: wizardDraftForClarify("кепка", "Китай"),
      step: 1,
    });
    expect(qs[0]?.id).toBe("tnved-form");
    const cap = qs[0]?.options?.find((o) => o.id === "cap");
    expect(cap?.hsHeading).toBe("6505003000");
    expect(hsHintFromClarify(qs, { "tnved-form": cap!.value })).toBe("6505003000");
  });

  it("молоко / кеды / кроссовки packs stay correct", async () => {
    expect(matchHintPack("молоко")?.id).toBe("milk");
    expect(matchHintPack("кеды")?.id).toBe("footwear");
    expect(matchHintPack("кроссовки")?.id).toBe("footwear");
    const milk = hintTreeQuestions("молоко")[0];
    expect(milk.options.find((o) => o.id === "fresh")?.hsHeading).toBe("0401");
    const shoes = hintTreeQuestions("кеды")[0];
    expect(shoes.options.find((o) => o.id === "sport")?.hsHeading).toBe("6404110000");
    expect(shoes.options.some((o) => o.id === "other-shoe")).toBe(true);
  });
});

describe("critical HS reliability — attr-suggest must not steal chapters", () => {
  it("кеды текстиль → footwear 6404, not apparel 6203", () => {
    const out = heuristicAttrSuggest({ name: "кеды текстиль", description: "кеды текстиль" });
    expect(out.attrs.hsHint || "").toMatch(/6404/);
    expect(out.attrs.hsHint || "").not.toMatch(/6203/);
    expect(out.attrs.purpose).toMatch(/обув/i);
  });

  it("кепка / молоко / кроссовки / огурец get dedicated hints", () => {
    expect(heuristicAttrSuggest({ name: "кепка" }).attrs.hsHint || "").toMatch(/6505\s*00\s*300/);
    expect(heuristicAttrSuggest({ name: "шапка" }).attrs.hsHint || "").toMatch(/6505\s*00\s*900/);
    expect(heuristicAttrSuggest({ name: "молоко" }).attrs.hsHint || "").toMatch(/0401/);
    expect(heuristicAttrSuggest({ name: "кроссовки" }).attrs.hsHint || "").toMatch(/6404/);
    const produce = heuristicAttrSuggest({ name: "огурец" });
    expect(produce.attrs.hsHint || "").toMatch(/0707/);
    expect(produce.attrs.hsHint || "").not.toMatch(/61|0403/);
    expect(produce.notes.join(" ")).toMatch(/clarify-only/i);
  });
});

describe("critical HS reliability — field dictionary", () => {
  it("typeahead finds кепка / молоко / кеды", () => {
    expect(filterFieldSuggestions("itemName", "кепк").some((e) => e.value === "кепка")).toBe(true);
    expect(filterFieldSuggestions("itemName", "молок").some((e) => e.value === "молоко")).toBe(true);
    expect(filterFieldSuggestions("itemName", "кед").some((e) => e.value === "кроссовки")).toBe(true);
  });
});
