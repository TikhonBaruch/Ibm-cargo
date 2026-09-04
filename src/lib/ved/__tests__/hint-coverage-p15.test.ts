/**
 * Cov-P15: apparel ATTR leftovers + home/textiles pack stems.
 * Canon: docs/knowledge/plan-hint-gap-probe-run.md §6.3
 */
import { describe, expect, it } from "vitest";
import {
  attrSuggestIsClarifyOnly,
  heuristicAttrSuggest,
} from "../attr-suggest";
import { matchHintPack } from "../tnved-hint-trees";

describe("Cov-P15 — apparel packs (F5)", () => {
  it.each([
    ["галстук", "tie-belt", "6215"],
    ["ремень", "tie-belt", "4203"],
    ["пижама", "underwear-sleep", "6107"],
    ["халат", "underwear-sleep", "6107"],
    ["плащ", "outerwear", "6201"],
  ] as const)("%s → pack %s hs %s", (q, packId, prefix) => {
    expect(matchHintPack(q)?.id).toBe(packId);
    const out = heuristicAttrSuggest({ description: q });
    expect(attrSuggestIsClarifyOnly(out)).toBe(true);
    expect(out.attrs.hsHint || "").toContain(prefix);
  });
});

describe("Cov-P15 — home / textiles packs", () => {
  it.each([
    ["хлопок", "textiles-raw"],
    ["полка", "bedroom-furniture"],
    ["стол", "furniture"],
    ["лампа", "lamps"],
    ["полотенце", "home-textiles"],
    ["посуда", "tableware"],
    ["контейнер", "cutlery"],
  ] as const)("%s → %s", (q, pack) => {
    expect(matchHintPack(q)?.id).toBe(pack);
  });

  it("false-friends stay correct", () => {
    expect(matchHintPack("столовая ложка")?.id).toBe("cutlery");
    expect(matchHintPack("столовая ложка")?.id).not.toBe("furniture");
    expect(matchHintPack("посудомоечная машина")?.id).toBe("appliances");
    expect(matchHintPack("лампочка")?.id).toBe("led");
  });

  it("laundry hangers closed in Cov-P19 → home-textiles", () => {
    expect(matchHintPack("вешалка")?.id).toBe("home-textiles");
    expect(matchHintPack("корзина для белья")?.id).toBe("home-textiles");
  });
});
