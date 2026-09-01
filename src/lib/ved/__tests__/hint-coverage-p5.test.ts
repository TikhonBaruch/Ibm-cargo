/**
 * Coverage P5: personal-care / baby / tools / cookware / tableware / batteries / networking / home-textiles
 * + cosmetics detail (помада/шампунь).
 */
import { describe, expect, it } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";

describe("coverage P5 — open sections after P4", () => {
  it.each([
    ["помада", "cosmetics"],
    ["шампунь", "cosmetics"],
    ["мыло", "personal-care"],
    ["зубная паста", "personal-care"],
    ["подгузник", "baby"],
    ["памперс", "baby"],
    ["дрель", "tools"],
    ["молоток", "tools"],
    ["кастрюля", "cookware"],
    ["сковорода", "cookware"],
    ["тарелка", "tableware"],
    ["чашка", "tableware"],
    ["батарейка", "batteries"],
    ["аккумулятор", "batteries"],
    ["роутер", "networking"],
    ["маршрутизатор", "networking"],
    ["одеяло", "home-textiles"],
    ["подушка", "home-textiles"],
  ] as const)("%s → %s", (q, pack) => {
    expect(matchHintPack(q)?.id).toBe(pack);
  });

  it("steal guards across P5", () => {
    expect(matchHintPack("power bank")?.id).toBe("power");
    expect(matchHintPack("повербанк")?.id).toBe("power");
    expect(matchHintPack("ноутбук")?.id).toBe("computers");
    expect(matchHintPack("шуруп")?.id).toBe("fasteners");
    expect(matchHintPack("корм для кошек")?.id).toBe("pet-food");
    expect(matchHintPack("посудомоечная машина")?.id).toBe("appliances");
  });
});
