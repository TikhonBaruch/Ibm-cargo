/**
 * Coverage P0: apparel attr split, plant dairy, mouse≠PC.
 * Canon: docs/knowledge/plan-hint-coverage-p0.md
 */
import { describe, expect, it } from "vitest";
import { heuristicAttrSuggest } from "../attr-suggest";
import { matchHintPack } from "../tnved-hint-trees";
import { matchClassifyAlias } from "../tnved-classify-aliases";
import { isPlantDairyQuery, isPointerDeviceQuery } from "../tnved-query-match";

describe("coverage P0 — apparel attr", () => {
  it("куртка / платье do not get jeans 6203 42", () => {
    const jacket = heuristicAttrSuggest({ name: "куртка" });
    expect(jacket.attrs.hsHint || "").toMatch(/6201/);
    expect(jacket.attrs.hsHint || "").not.toMatch(/6203\s*42/);

    const dress = heuristicAttrSuggest({ name: "платье" });
    expect(dress.attrs.hsHint || "").toMatch(/6104/);
    expect(dress.attrs.hsHint || "").not.toMatch(/6203\s*42/);
  });

  it("джинсы / брюки keep 6203", () => {
    expect(heuristicAttrSuggest({ name: "джинсы" }).attrs.hsHint || "").toMatch(/6203/);
    expect(heuristicAttrSuggest({ name: "брюки" }).attrs.hsHint || "").toMatch(/6203/);
  });
});

describe("coverage P0 — plant dairy", () => {
  it.each([
    "соевое молоко",
    "овсяное молоко",
    "миндальное молоко",
    "кокосовое молоко",
    "рисовое молоко",
    "соевое молоко ванильное",
    "соевый йогурт",
    "миндальный йогурт",
  ] as const)("%s is plant dairy — not milk pack / 040x attr", (q) => {
    expect(isPlantDairyQuery(q)).toBe(true);
    expect(matchHintPack(q)?.id ?? null).not.toBe("milk");
    const attr = heuristicAttrSuggest({ name: q });
    expect(attr.attrs.hsHint || "").not.toMatch(/^040/);
    expect(attr.attrs.purpose || "").not.toMatch(/молочный продукт/);
    const alias = matchClassifyAlias(q);
    expect(alias?.alias.code.startsWith("040") ?? false).toBe(false);
  });

  it("обычное молоко / безлактозное молоко stay dairy", () => {
    expect(isPlantDairyQuery("молоко")).toBe(false);
    expect(matchHintPack("молоко")?.id).toBe("milk");
    expect(matchHintPack("безлактозное молоко")?.id).toBe("milk");
    expect(heuristicAttrSuggest({ name: "молоко" }).attrs.hsHint || "").toMatch(/0401/);
  });
});

describe("coverage P0 — mouse ≠ PC", () => {
  it.each(["мышь компьютерная", "компьютерная мышь", "USB мышь", "беспроводная мышь"] as const)(
    "%s is pointer — not computers / laptop attr",
    (q) => {
      expect(isPointerDeviceQuery(q)).toBe(true);
      expect(matchHintPack(q)?.id ?? null).not.toBe("computers");
      const attr = heuristicAttrSuggest({ name: q });
      expect(attr.attrs.hsHint || "").not.toMatch(/8471/);
      expect(attr.attrs.purpose || "").not.toMatch(/вычислительн/);
    },
  );

  it("ноутбук / компьютер still computers", () => {
    expect(matchHintPack("ноутбук")?.id).toBe("computers");
    expect(matchHintPack("компьютер")?.id).toBe("computers");
    expect(heuristicAttrSuggest({ name: "ноутбук" }).attrs.hsHint || "").toMatch(/8471/);
  });
});
