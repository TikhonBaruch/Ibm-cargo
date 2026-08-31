import { describe, expect, it } from "vitest";
import { heuristicAttrSuggest, suggestProductAttrs, attrSuggestHasChips } from "../attr-suggest";

describe("attr-suggest", () => {
  it("fills apparel attrs for майка without overwriting existing", () => {
    const out = heuristicAttrSuggest({
      name: "майка",
      existing: { brand: "Nike" },
    });
    expect(out.engine).toBe("heuristic-v1");
    expect(out.attrs.material).toBe("трикотаж");
    expect(out.attrs.composition).toMatch(/хлопок/i);
    expect(out.attrs.purpose).toMatch(/одежд/i);
    expect(out.attrs.extra?.color).toBeTruthy();
    expect(out.attrs.extra?.ageGroup).toBeTruthy();
    expect(out.attrs.hsHint).toMatch(/6109/);
    expect(out.attrs.brand).toBeUndefined();
    expect(attrSuggestHasChips(out)).toBe(true);
  });

  it("returns empty chips for too-short text", () => {
    const out = suggestProductAttrs({ name: "аб" });
    expect(attrSuggestHasChips(out)).toBe(false);
  });

  it("does not replace a filled material", () => {
    const out = heuristicAttrSuggest({
      name: "майка хлопок",
      existing: { material: "лён" },
    });
    expect(out.attrs.material).toBeUndefined();
    expect(out.attrs.composition).toBeTruthy();
  });

  it("suggests socks attrs for носки", () => {
    const out = heuristicAttrSuggest({ name: "носки" });
    expect(out.attrs.purpose).toMatch(/носочн/i);
    expect(out.attrs.material).toBe("трикотаж");
    expect(out.attrs.hsHint).toMatch(/6115/);
  });

  it("does not map кеды текстиль to apparel 62xx", () => {
    const out = heuristicAttrSuggest({ name: "кеды текстиль" });
    expect(out.attrs.hsHint).toMatch(/6404/);
    expect(out.attrs.purpose).toMatch(/обув/i);
  });
});
