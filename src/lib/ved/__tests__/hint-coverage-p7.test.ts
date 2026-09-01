/**
 * Cov-P7: food packs — grains, meat, fish, pantry, snacks, spirits.
 * Canon: docs/knowledge/plan-hint-coverage-expansion.md §Cov-P7
 */
import { describe, expect, it } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";

describe("Cov-P7 — food packs positive", () => {
  it.each([
    ["рис", "grains-pasta"],
    ["мука", "grains-pasta"],
    ["макароны", "grains-pasta"],
    ["гречка", "grains-pasta"],
    ["хлеб", "grains-pasta"],
    ["колбаса", "meat"],
    ["сосиски", "meat"],
    ["мясо", "meat"],
    ["говядина", "meat"],
    ["рыба", "fish-seafood"],
    ["лосось", "fish-seafood"],
    ["креветки", "fish-seafood"],
    ["консервы рыбные", "fish-seafood"],
    ["мёд", "pantry-sweet"],
    ["орехи", "pantry-sweet"],
    ["сахар", "pantry-sweet"],
    ["масло подсолнечное", "pantry-sweet"],
    ["чипсы", "snacks"],
    ["батончик", "snacks"],
    ["энергетик", "snacks"],
    ["сок апельсиновый", "snacks"],
    ["компот", "snacks"],
    ["водка", "spirits"],
    ["виски", "spirits"],
    ["коньяк", "spirits"],
  ] as const)("%s → %s", (q, pack) => {
    expect(matchHintPack(q)?.id).toBe(pack);
  });
});

describe("Cov-P7 — must-not cross-family", () => {
  it.each([
    ["рис", "produce-fresh"],
    ["колбаса", "produce-fresh"],
    ["рыба", "produce-fresh"],
    ["мёд", "milk"],
    ["масло подсолнечное", "milk"],
    ["чипсы", "fruit-fresh"],
    ["сок апельсиновый", "fruit-fresh"],
    ["водка", "beverages"],
    ["колбаса", "pet-food"],
    ["огурец", "grains-pasta"],
    ["молоко", "grains-pasta"],
  ] as const)("%s must not → %s", (q, mustNot) => {
    expect(matchHintPack(q)?.id ?? null).not.toBe(mustNot);
  });
});

describe("Cov-P7 — food disambiguation guards", () => {
  it("сливочное масло → milk (not pantry-sweet)", () => {
    expect(matchHintPack("сливочное масло")?.id).toBe("milk");
    expect(matchHintPack("масло сливочное")?.id).toBe("milk");
  });

  it("консервы овощные → produce-fresh (not fish-seafood)", () => {
    expect(matchHintPack("консервы овощные")?.id).toBe("produce-fresh");
    expect(matchHintPack("консервы рыбные")?.id).toBe("fish-seafood");
  });

  it("лимонад stays beverages (Cov-P0 regression)", () => {
    expect(matchHintPack("лимонад")?.id).toBe("beverages");
  });

  it("existing food packs unchanged", () => {
    expect(matchHintPack("огурец")?.id).toBe("produce-fresh");
    expect(matchHintPack("молоко")?.id).toBe("milk");
    expect(matchHintPack("шоколад")?.id).toBe("chocolate");
    expect(matchHintPack("пиво")?.id).toBe("beverages");
    expect(matchHintPack("яблоко")?.id).toBe("fruit-fresh");
  });
});
