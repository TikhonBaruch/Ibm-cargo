import { describe, expect, it } from "vitest";
import { heuristicAttrSuggest, suggestProductAttrs, attrSuggestHasChips, attrSuggestIsClarifyOnly } from "../attr-suggest";

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

  it("P10: колготки share hosiery attrs with носки", () => {
    const out = heuristicAttrSuggest({ name: "колготки" });
    expect(out.attrs.hsHint).toMatch(/6115/);
    expect(out.attrs.purpose).toMatch(/носочн|чулочн/i);
  });

  it("does not map кеды текстиль to apparel 62xx", () => {
    const out = heuristicAttrSuggest({ name: "кеды текстиль" });
    expect(out.attrs.hsHint).toMatch(/6404/);
    expect(out.attrs.purpose).toMatch(/обув/i);
  });

  it("P4: огурец is clarify-only produce — not silent generic, not apparel 61", () => {
    const out = heuristicAttrSuggest({ name: "огурец" });
    expect(attrSuggestHasChips(out)).toBe(true);
    expect(attrSuggestIsClarifyOnly(out)).toBe(true);
    expect(out.attrs.hsHint).toMatch(/0707/);
    expect(out.attrs.purpose).toMatch(/овощ|produce/i);
    expect(out.attrs.extra?.clarifyPack).toBe("produce-fresh");
    expect(out.notes.join(" ")).toMatch(/clarify-only|свеж|консерв/i);
    expect(out.attrs.hsHint || "").not.toMatch(/61|6203|0403/);
    expect(out.notes.join(" ")).not.toMatch(/Добавьте состав, материал или тип/);
  });

  it.each(["огурцы", "корнишоны", "помидор", "маринованные огурцы"] as const)(
    "P4: %s → produce clarify-only",
    (name) => {
      const out = heuristicAttrSuggest({ name });
      expect(attrSuggestIsClarifyOnly(out)).toBe(true);
      expect(out.attrs.extra?.foodKind).toBe("овощи");
    },
  );
});
