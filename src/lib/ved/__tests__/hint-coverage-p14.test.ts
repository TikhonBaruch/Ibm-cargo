/**
 * Cov-P14: food MISS triggers (bakery, chicken, soft drinks, ready-meals).
 * Canon: docs/knowledge/plan-hint-gap-probe-run.md §6.2
 */
import { describe, expect, it } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";

describe("Cov-P14 — bakery → grains-pasta", () => {
  it.each(["вафли", "торт", "waffle", "cake"] as const)("%s → grains-pasta", (q) => {
    expect(matchHintPack(q)?.id).toBe("grains-pasta");
  });
});

describe("Cov-P14 — курица → meat", () => {
  it("куриц stem (not only курин)", () => {
    expect(matchHintPack("курица")?.id).toBe("meat");
    expect(matchHintPack("куринный")?.id).toBe("meat");
  });

  it("суп куриный stays prepared-food", () => {
    expect(matchHintPack("суп куриный")?.id).toBe("prepared-food");
  });
});

describe("Cov-P14 — beverages soft / sparkling / water", () => {
  it.each([
    ["шампанское", "beverages"],
    ["кола", "beverages"],
    ["минеральная вода", "beverages"],
    ["лимонад", "beverages"],
  ] as const)("%s → %s", (q, want) => {
    expect(matchHintPack(q)?.id).toBe(want);
  });

  it("кола must not steal speakers", () => {
    expect(matchHintPack("колонка")?.id).toBe("speakers");
  });
});

describe("Cov-P14 — ready meals → prepared-food", () => {
  it.each(["мороженое", "пельмени", "пицца", "pizza"] as const)("%s → prepared-food", (q) => {
    expect(matchHintPack(q)?.id).toBe("prepared-food");
  });
});
