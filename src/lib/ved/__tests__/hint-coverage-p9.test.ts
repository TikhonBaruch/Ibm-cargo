/**
 * Cov-P9: long-tail packs — stationery/jewelry/musical/tobacco/…
 * Canon: docs/knowledge/plan-hint-coverage-expansion.md §Cov-P9
 */
import { describe, expect, it } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";

describe("Cov-P9 — positive packs", () => {
  it.each([
    ["ручка", "stationery"],
    ["карандаш", "stationery"],
    ["скотч", "stationery"],
    ["блокнот", "stationery"],
    ["кольцо", "jewelry"],
    ["серьги", "jewelry"],
    ["браслет", "jewelry"],
    ["гитара", "musical"],
    ["синтезатор", "musical"],
    ["сигареты", "tobacco"],
    ["табак", "tobacco"],
    ["кальян", "tobacco"],
    ["комбикорм", "agri-feed"],
    ["сено", "agri-feed"],
    ["ткань", "textiles-raw"],
    ["пряжа", "textiles-raw"],
    ["нитки", "textiles-raw"],
    ["xbox", "gaming"],
    ["геймпад", "gaming"],
    ["playstation", "gaming"],
    ["бампер", "auto-body"],
    ["фара", "auto-body"],
    ["дворники", "auto-body"],
    ["термометр", "med-devices"],
    ["тонометр", "med-devices"],
    ["инвалидная коляска", "med-devices"],
    ["розетка", "electrical-install"],
    ["выключатель", "electrical-install"],
    ["кабель электрический", "electrical-install"],
  ] as const)("%s → %s", (q, pack) => {
    expect(matchHintPack(q)?.id).toBe(pack);
  });
});

describe("Cov-P9 — must-not / steal guards", () => {
  it.each([
    ["ручка", "books"],
    ["кольцо", "watches"],
    ["сигареты", "vape"],
    ["электронная сигарета", "tobacco"],
    ["комбикорм", "pet-food"],
    ["сено", "pet-food"],
    ["ткань", "knit-top"],
    ["ткань", "woven-apparel"],
    ["playstation", "toys"],
    ["геймпад", "toys"],
    ["бампер", "auto-parts"],
    ["термометр", "med-disposables"],
    ["термометр", "pharma"],
    ["розетка", "power"],
    ["кабель электрический", "power"],
  ] as const)("%s must not → %s", (q, mustNot) => {
    expect(matchHintPack(q)?.id ?? null).not.toBe(mustNot);
  });

  it("regressions + POLICY", () => {
    expect(matchHintPack("вейп")?.id).toBe("vape");
    expect(matchHintPack("электронная сигарета")?.id).toBe("vape");
    expect(matchHintPack("игрушка")?.id).toBe("toys");
    expect(matchHintPack("лего")?.id).toBe("toys");
    expect(matchHintPack("корм для кошек")?.id).toBe("pet-food");
    expect(matchHintPack("семена")?.id).toBe("agri-inputs");
    expect(matchHintPack("часы")?.id).toBe("watches");
    expect(matchHintPack("кабель usb")?.id).toBe("power");
    expect(matchHintPack("провод")).toBeNull();
    expect(matchHintPack("камера")).toBeNull();
    expect(matchHintPack("тетрадь")?.id).toBe("books");
  });
});
