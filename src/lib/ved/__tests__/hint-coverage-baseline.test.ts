/**
 * Cov-P0 baseline: fix known WRONG pack steals before Cov-P7 expansion.
 * Canon: docs/knowledge/plan-hint-coverage-expansion.md §Cov-P0
 */
import { describe, expect, it } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";
import {
  isCoffeeMachineQuery,
  isCarSeatQuery,
  isJuiceOrBeverageQuery,
  isLaundryDetergentQuery,
  packTriggerMatches,
} from "../tnved-query-match";

describe("Cov-P0 baseline — WRONG fixes", () => {
  it.each([
    ["лимонад", "beverages"],
    ["lemonade", "beverages"],
  ] as const)("%s → %s (not fruit-fresh)", (q, pack) => {
    expect(matchHintPack(q)?.id).toBe(pack);
    expect(matchHintPack(q)?.id).not.toBe("fruit-fresh");
  });

  it("fresh lemon still maps to fruit-fresh", () => {
    expect(matchHintPack("лимон свежий")?.id).toBe("fruit-fresh");
    expect(matchHintPack("лимон")?.id).toBe("fruit-fresh");
  });

  it.each([
    ["кофемашина", "appliances"],
    ["coffee machine", "appliances"],
  ] as const)("%s → %s (not tea-coffee)", (q, pack) => {
    expect(isCoffeeMachineQuery(q)).toBe(true);
    expect(matchHintPack(q)?.id).toBe(pack);
    expect(matchHintPack(q)?.id).not.toBe("tea-coffee");
  });

  it("кофе / coffee still map to tea-coffee", () => {
    expect(matchHintPack("кофе")?.id).toBe("tea-coffee");
    expect(matchHintPack("coffee")?.id).toBe("tea-coffee");
  });

  it.each([
    ["автокресло", "baby"],
    ["детское автокресло", "baby"],
  ] as const)("%s → %s (not furniture)", (q, pack) => {
    expect(isCarSeatQuery(q)).toBe(true);
    expect(matchHintPack(q)?.id).toBe(pack);
    expect(matchHintPack(q)?.id).not.toBe("furniture");
  });

  it("home chair still maps to furniture", () => {
    expect(matchHintPack("кресло")?.id).toBe("furniture");
    expect(matchHintPack("диван")?.id).toBe("furniture");
  });

  it("стиральный порошок → cleaning (not appliances)", () => {
    expect(isLaundryDetergentQuery("стиральный порошок")).toBe(true);
    expect(matchHintPack("стиральный порошок")?.id).toBe("cleaning");
    expect(matchHintPack("порошок стиральный")?.id).toBe("cleaning");
  });

  it("стиральная машина still maps to appliances", () => {
    expect(isLaundryDetergentQuery("стиральная машина")).toBe(false);
    expect(matchHintPack("стиральная машина")?.id).toBe("appliances");
  });
});

describe("Cov-P0 baseline — trigger hygiene", () => {
  it("кофе stem does not match кофемашина", () => {
    expect(packTriggerMatches("кофемашина", "кофе")).toBe(false);
  });

  it("лимонад is juice/beverage guard", () => {
    expect(isJuiceOrBeverageQuery("лимонад")).toBe(true);
    expect(isJuiceOrBeverageQuery("яблочный сок")).toBe(true);
  });
});
