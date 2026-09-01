/**
 * Coverage P2: fruit-fresh / woven-apparel / prepared-food packs + guards.
 * Canon: docs/knowledge/plan-hint-coverage-p0.md §P2
 */
import { describe, expect, it } from "vitest";
import { matchHintPack, hintTreeQuestions } from "../tnved-hint-trees";

describe("coverage P2 — fruit-fresh", () => {
  it.each(["фрукты", "яблоко", "банан", "апельсин", "ягоды", "клубника", "арбуз"] as const)(
    "%s → fruit-fresh",
    (q) => expect(matchHintPack(q)?.id).toBe("fruit-fresh"),
  );

  it("яблочный сок / фруктовый сок do not steal fruit-fresh", () => {
    expect(matchHintPack("яблочный сок")?.id ?? null).not.toBe("fruit-fresh");
    expect(matchHintPack("фруктовый сок")?.id ?? null).not.toBe("fruit-fresh");
  });

  it("fruit chips expose 08 headings", () => {
    const hs = hintTreeQuestions("яблоко")[0]?.options.map((o) => o.hsHeading) || [];
    expect(hs).toEqual(expect.arrayContaining(["0808", "0803", "0805", "0810", "08"]));
  });
});

describe("coverage P2 — woven-apparel", () => {
  it.each(["рубашка", "блузка", "брюки", "штаны", "джинсы", "юбка", "шорты"] as const)(
    "%s → woven-apparel (not knit-top)",
    (q) => {
      expect(matchHintPack(q)?.id).toBe("woven-apparel");
      expect(matchHintPack(q)?.id).not.toBe("knit-top");
    },
  );

  it("майка / футболка stay knit-top", () => {
    expect(matchHintPack("майка")?.id).toBe("knit-top");
    expect(matchHintPack("футболка")?.id).toBe("knit-top");
  });
});

describe("coverage P2 — prepared-food", () => {
  it.each(["суп", "борщ", "суп куриный", "овощной суп", "бульон"] as const)(
    "%s → prepared-food",
    (q) => expect(matchHintPack(q)?.id).toBe("prepared-food"),
  );

  it("овощной суп does not stay on produce-fresh", () => {
    expect(matchHintPack("овощной суп")?.id).not.toBe("produce-fresh");
  });

  it("огурец stays produce-fresh", () => {
    expect(matchHintPack("огурец")?.id).toBe("produce-fresh");
  });
});
