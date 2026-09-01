/**
 * P7: short pack-trigger hygiene — boundary / false-friend / pepper policy.
 * Canon: docs/knowledge/plan-hint-chains-precision-audit.md §P7.
 */
import { describe, expect, it } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";
import {
  isShortTriggerFalseFriend,
  packTriggerMatches,
  SHORT_TRIGGER_FALSE_FRIENDS,
} from "../tnved-query-match";

describe("P7 packTriggerMatches policy", () => {
  it("len≤3: token boundary only (лук≠луковица via bare лук)", () => {
    expect(packTriggerMatches("лук", "лук")).toBe(true);
    expect(packTriggerMatches("зелёный лук", "лук")).toBe(true);
    expect(packTriggerMatches("луковица", "лук")).toBe(false);
    expect(packTriggerMatches("чайка", "чай")).toBe(false);
  });

  it("len===4: prefix ok for truncated stems, blocked for false friends", () => {
    expect(packTriggerMatches("майка", "майк")).toBe(true);
    expect(packTriggerMatches("кепка", "кепк")).toBe(true);
    expect(packTriggerMatches("ноутбук", "ноут")).toBe(true);
    expect(packTriggerMatches("полотенце", "поло")).toBe(false);
    expect(packTriggerMatches("кофеин", "кофе")).toBe(false);
    expect(packTriggerMatches("кофе", "кофе")).toBe(true);
    expect(packTriggerMatches("поло", "поло")).toBe(true);
  });

  it("len≥5: substring (огурц→огурцы, луков→луковица)", () => {
    expect(packTriggerMatches("огурцы", "огурц")).toBe(true);
    expect(packTriggerMatches("луковица", "луков")).toBe(true);
  });

  it("exports short-trigger denylist fixtures", () => {
    expect(SHORT_TRIGGER_FALSE_FRIENDS.length).toBeGreaterThanOrEqual(3);
    expect(isShortTriggerFalseFriend("поло", "полотенце кухонное")).toBe(true);
    expect(isShortTriggerFalseFriend("кофе", "кофеин таблетки")).toBe(true);
  });
});

describe("P7 pack match — short trigger regressions", () => {
  it("полотенце / кофеин do not steal knit-top / tea-coffee", () => {
    expect(matchHintPack("полотенце")?.id ?? null).not.toBe("knit-top");
    expect(matchHintPack("кофеин")?.id ?? null).not.toBe("tea-coffee");
    expect(matchHintPack("поло")?.id).toBe("knit-top");
    expect(matchHintPack("кофе")?.id).toBe("tea-coffee");
  });

  it("лук / луковица → produce; bare лук stays produce", () => {
    expect(matchHintPack("лук")?.id).toBe("produce-fresh");
    expect(matchHintPack("лук репчатый")?.id).toBe("produce-fresh");
    expect(matchHintPack("луковица")?.id).toBe("produce-fresh");
  });

  it("sweet/bell pepper → produce; bare / black pepper do not", () => {
    expect(matchHintPack("перец сладкий")?.id).toBe("produce-fresh");
    expect(matchHintPack("сладкий перец")?.id).toBe("produce-fresh");
    expect(matchHintPack("перец болгарский")?.id).toBe("produce-fresh");
    expect(matchHintPack("bell pepper")?.id).toBe("produce-fresh");
    expect(matchHintPack("перец")?.id ?? null).toBeNull();
    expect(matchHintPack("чёрный перец")?.id ?? null).not.toBe("produce-fresh");
    expect(matchHintPack("перец горошком")?.id ?? null).not.toBe("produce-fresh");
  });

  it("майка / кепка / худи still match after P7 tighten", () => {
    expect(matchHintPack("майка")?.id).toBe("knit-top");
    expect(matchHintPack("кепка")?.id).toBe("headgear");
    expect(matchHintPack("худи")?.id).toBe("knit-top");
    expect(matchHintPack("кеды")?.id).toBe("footwear");
  });

  it("крем-брюле does not steal cosmetics via крем", () => {
    expect(matchHintPack("крем-брюле")?.id ?? null).not.toBe("cosmetics");
    expect(matchHintPack("крем для лица")?.id).toBe("cosmetics");
  });
});
