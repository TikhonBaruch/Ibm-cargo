/**
 * Cov-P8: home / electronics parts / auto fluids / baby-gear.
 * Canon: docs/knowledge/plan-hint-coverage-expansion.md §Cov-P8
 */
import { describe, expect, it } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";

describe("Cov-P8 — positive packs", () => {
  it.each([
    ["чайник", "small-appliances"],
    ["блендер", "small-appliances"],
    ["мультиварка", "small-appliances"],
    ["кондиционер", "small-appliances"],
    ["кофеварка", "small-appliances"],
    ["матрас", "bedroom-furniture"],
    ["кровать", "bedroom-furniture"],
    ["шкаф", "bedroom-furniture"],
    ["шторы", "bedroom-furniture"],
    ["зеркало", "bedroom-furniture"],
    ["нож", "cutlery"],
    ["вилка", "cutlery"],
    ["ложка", "cutlery"],
    ["термос", "cutlery"],
    ["стиральный порошок", "cleaning"],
    ["губка", "cleaning"],
    ["швабра", "cleaning"],
    ["SSD", "pc-parts"],
    ["видеокарта", "pc-parts"],
    ["флешка", "pc-parts"],
    ["процессор", "pc-parts"],
    ["фотоаппарат", "photo-gear"],
    ["объектив", "photo-gear"],
    ["штатив", "photo-gear"],
    ["моторное масло", "auto-fluids"],
    ["антифриз", "auto-fluids"],
    ["тормозные колодки", "auto-fluids"],
    ["клей", "adhesives-chemicals"],
    ["смазка", "adhesives-chemicals"],
    ["WD-40", "adhesives-chemicals"],
    ["коляска", "baby-gear"],
    ["манеж", "baby-gear"],
    ["пустышка", "baby-gear"],
  ] as const)("%s → %s", (q, pack) => {
    expect(matchHintPack(q)?.id).toBe(pack);
  });
});

describe("Cov-P8 — must-not / steal guards", () => {
  it.each([
    ["чайник", "tea-coffee"],
    ["кофеварка", "tea-coffee"],
    ["кофемашина", "tea-coffee"],
    ["матрас", "furniture"],
    ["шкаф", "furniture"],
    ["нож", "tools"],
    ["стиральный порошок", "appliances"],
    ["SSD", "computers"],
    ["флешка", "computers"],
    ["фотоаппарат", "security-cam"],
    ["моторное масло", "pantry-sweet"],
    ["моторное масло", "milk"],
    ["клей", "paint"],
    ["коляска", "furniture"],
  ] as const)("%s must not → %s", (q, mustNot) => {
    expect(matchHintPack(q)?.id ?? null).not.toBe(mustNot);
  });

  it("regressions: existing packs / POLICY", () => {
    expect(matchHintPack("кофемашина")?.id).toBe("appliances");
    expect(matchHintPack("автокресло")?.id).toBe("baby");
    expect(matchHintPack("стиральная машина")?.id).toBe("appliances");
    expect(matchHintPack("ноутбук")?.id).toBe("computers");
    expect(matchHintPack("диван")?.id).toBe("furniture");
    expect(matchHintPack("тарелка")?.id).toBe("tableware");
    expect(matchHintPack("камера")).toBeNull();
    expect(matchHintPack("огурец")?.id).toBe("produce-fresh");
  });
});
