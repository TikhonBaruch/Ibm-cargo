/**
 * Cov-P13: plant-dairy POLICY-HIT + diverge guards (yoga mat, шкаф).
 * Canon: docs/knowledge/plan-hint-gap-probe-run.md §6.1
 */
import { describe, expect, it } from "vitest";
import { heuristicAttrSuggest } from "../attr-suggest";
import { matchHintPack } from "../tnved-hint-trees";
import { isPlantDairyQuery, isYogaMatQuery } from "../tnved-query-match";

describe("Cov-P13 — ореховое молоко plant dairy", () => {
  it.each(["ореховое молоко", "ореховый йогурт", "hazelnut milk", "nut milk"] as const)(
    "%s ≠ milk",
    (q) => {
      expect(isPlantDairyQuery(q)).toBe(true);
      expect(matchHintPack(q)?.id ?? null).not.toBe("milk");
      expect(matchHintPack(q)?.id ?? null).not.toBe("pantry-sweet");
      const attr = heuristicAttrSuggest({ name: q });
      expect(attr.attrs.hsHint || "").not.toMatch(/^040/);
    },
  );

  it("dairy milk still milk", () => {
    expect(matchHintPack("молоко")?.id).toBe("milk");
    expect(isPlantDairyQuery("орехи")).toBe(false);
  });
});

describe("Cov-P13 — коврик йога ≠ rugs", () => {
  it("yoga mat → sports", () => {
    expect(isYogaMatQuery("коврик йога")).toBe(true);
    expect(isYogaMatQuery("yoga mat")).toBe(true);
    expect(isYogaMatQuery("коврик")).toBe(false);
    expect(matchHintPack("коврик йога")?.id).toBe("sports");
    expect(matchHintPack("коврик йога")?.id).not.toBe("rugs");
  });

  it("bare коврик stays rugs", () => {
    expect(matchHintPack("коврик")?.id).toBe("rugs");
    expect(matchHintPack("ковёр")?.id).toBe("rugs");
  });
});

describe("Cov-P13 — шкаф → bedroom-furniture", () => {
  it("шкаф is bedroom wardrobe not seating furniture", () => {
    expect(matchHintPack("шкаф")?.id).toBe("bedroom-furniture");
    expect(matchHintPack("шкаф")?.id).not.toBe("furniture");
  });

  it("диван / стул stay furniture", () => {
    expect(matchHintPack("диван")?.id).toBe("furniture");
    expect(matchHintPack("стул")?.id).toBe("furniture");
    expect(matchHintPack("кресло")?.id).toBe("furniture");
  });
});
