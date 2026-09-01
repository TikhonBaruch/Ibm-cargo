/**
 * Coverage P3: art / bags / watches / beverages / speakers / furniture / tires / cycles.
 */
import { describe, expect, it } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";

describe("coverage P3 — remaining open sections", () => {
  it.each([
    ["картина", "art"],
    ["скульптура", "art"],
    ["сумка", "bags"],
    ["рюкзак", "bags"],
    ["чемодан", "bags"],
    ["часы", "watches"],
    ["apple watch", "watches"],
    ["пиво", "beverages"],
    ["вино", "beverages"],
    ["колонка bluetooth", "speakers"],
    ["мебель", "furniture"],
    ["стул", "furniture"],
    ["шина", "tires"],
    ["велосипед", "cycles"],
    ["самокат", "cycles"],
  ] as const)("%s → %s", (q, pack) => {
    expect(matchHintPack(q)?.id).toBe(pack);
  });

  it("steal guards across P3", () => {
    expect(matchHintPack("наушники")?.id).toBe("headphones");
    expect(matchHintPack("яблочный сок")?.id ?? null).not.toBe("beverages");
    expect(matchHintPack("яблочный сок")?.id ?? null).not.toBe("fruit-fresh");
    expect(matchHintPack("виноград")?.id).toBe("fruit-fresh");
    expect(matchHintPack("ноутбук")?.id).toBe("computers");
    expect(matchHintPack("столовая ложка")?.id ?? null).not.toBe("furniture");
    expect(matchHintPack("стиральная машина")?.id ?? null).not.toBe("tires");
    expect(matchHintPack("шина")?.id).toBe("tires");
  });
});
