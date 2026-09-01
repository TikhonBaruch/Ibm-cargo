/**
 * H1–H3 morphology / false friends / produce pack.
 * Corpus A–E: plan-tnved-hint-chains-audit.md §3 P3.
 */
import { describe, expect, it } from "vitest";
import { matchHintPack, hintTreeQuestions } from "../tnved-hint-trees";
import { scoreTnvedSearchHit, tnvedSearchStems } from "../tnved";
import { matchClassifyAlias } from "../tnved-classify-aliases";
import {
  hasTokenOrPrefix,
  householdStemVariants,
  isFalseFriendPair,
  notesStemMatchKind,
  tnvedQueryStems,
} from "../tnved-query-match";

describe("H1 household stems (block A)", () => {
  it("огурец → огурц (not огуре)", () => {
    expect(householdStemVariants("огурец")).toEqual(expect.arrayContaining(["огурец", "огурц"]));
    expect(householdStemVariants("огурец")).not.toContain("огуре");
    expect(tnvedSearchStems("огурец")).toEqual(expect.arrayContaining(["огурец", "огурц"]));
    expect(tnvedSearchStems("огурец")).not.toContain("огуре");
  });

  it("огурцы / кепка / кепки / носок / носки", () => {
    expect(tnvedSearchStems("огурцы")).toEqual(expect.arrayContaining(["огурцы", "огурц"]));
    expect(tnvedSearchStems("кепка")).toEqual(expect.arrayContaining(["кепка", "кепк"]));
    expect(tnvedSearchStems("кепки")).toEqual(expect.arrayContaining(["кепки", "кепк"]));
    expect(tnvedSearchStems("носок")).toEqual(expect.arrayContaining(["носок", "носк"]));
    expect(tnvedSearchStems("носки")).toEqual(expect.arrayContaining(["носки", "носк"]));
  });

  it("помидор / помидоры share помидор stem", () => {
    expect(tnvedQueryStems("помидор")).toEqual(expect.arrayContaining(["помидор"]));
    expect(tnvedQueryStems("помидоры")).toEqual(expect.arrayContaining(["помидоры", "помидор"]));
  });

  it("title Огурцы scores for query огурец", () => {
    const stems = tnvedSearchStems("огурец");
    const score = scoreTnvedSearchHit(
      { code: "0707009001", titleRu: "Огурцы", notes: null, isLeaf: true, level: 10 },
      { stems, digits: "", phrase: "огурец" }
    );
    expect(score).toBeGreaterThan(30);
    expect(hasTokenOrPrefix("Огурцы", "огурц")).toBe(true);
  });
});

describe("H2 false friends (block B)", () => {
  it("огур hitchhike on йогурт notes is denylisted", () => {
    expect(isFalseFriendPair("огурец", "йогурт, yogurt, кисломолочные")).toBe(true);
    expect(isFalseFriendPair("йогурт", "йогурт, yogurt")).toBe(false);
  });

  it("short stem огур does not substring-score inside йогурт", () => {
    expect(notesStemMatchKind("йогурт натуральный", "огур")).toBeNull();
    const yogurtScore = scoreTnvedSearchHit(
      {
        code: "0403100000",
        titleRu: "Йогурт",
        notes: "йогурт, yogurt, кефир",
        isLeaf: true,
        level: 10,
      },
      { stems: ["огур", "огурец", "огурц"], digits: "", phrase: "огурец" }
    );
    const cucumberScore = scoreTnvedSearchHit(
      {
        code: "0707009001",
        titleRu: "Огурцы",
        notes: "огурцы свежие",
        isLeaf: true,
        level: 10,
      },
      { stems: tnvedSearchStems("огурец"), digits: "", phrase: "огурец" }
    );
    expect(cucumberScore).toBeGreaterThan(yogurtScore);
    expect(yogurtScore).toBeLessThan(50);
  });
});

describe("H3 produce-fresh pack (block D)", () => {
  it("огурец / огурцы → produce-fresh, not milk", () => {
    expect(matchHintPack("огурец")?.id).toBe("produce-fresh");
    expect(matchHintPack("огурцы свежие")?.id).toBe("produce-fresh");
    expect(matchHintPack("йогурт")?.id).toBe("milk");
  });

  it("produce options map to 07 / 20 headings", () => {
    const qs = hintTreeQuestions("помидор");
    expect(matchHintPack("помидор")?.id).toBe("produce-fresh");
    expect(qs[0].options.map((o) => o.hsHeading)).toEqual(
      expect.arrayContaining(["0707", "0711", "2001"])
    );
    expect(qs[0].options.every((o) => !o.hsHeading.startsWith("04"))).toBe(true);
  });

  it.each(["томат", "картофель", "морковь", "лук репчатый"] as const)(
    "%s → produce-fresh",
    (q) => {
      expect(matchHintPack(q)?.id).toBe("produce-fresh");
    }
  );
});

describe("block E negative / fail-open", () => {
  it("empty and stopwords yield no stems", () => {
    expect(tnvedSearchStems("")).toEqual([]);
    expect(tnvedSearchStems("для")).toEqual([]);
    expect(matchHintPack("для")).toBeNull();
  });

  it("garbage query does not match produce or milk packs", () => {
    expect(matchHintPack("asdfqwer zxcv")).toBeNull();
    expect(matchHintPack("!!!")).toBeNull();
    expect(tnvedQueryStems("   ")).toEqual([]);
  });
});

describe("block C critical HS regression", () => {
  it("кепка still hits notes кепки", () => {
    const score = scoreTnvedSearchHit(
      { code: "6505003000", notes: "фуражки, кепки, козырьками", isLeaf: true, level: 10 },
      { stems: tnvedSearchStems("кепка"), digits: "", phrase: "кепка" }
    );
    expect(score).toBeGreaterThan(20);
  });

  it.each([
    ["молоко", "0401"],
    ["кеды", "640411"],
    ["ноутбук", "847130"],
    ["огурец", "0707"],
  ] as const)("%s classify alias stays on chapter %s", (q, prefix) => {
    const hit = matchClassifyAlias(q);
    expect(hit, q).toBeTruthy();
    expect(hit!.alias.code.replace(/\D/g, "").startsWith(prefix)).toBe(true);
  });
});

describe("P3 produce cascade + search false-friend clothing", () => {
  it.each([
    ["маринованные огурцы", "2001"],
    ["корнишоны", "2001"],
    ["огурцы в рассоле", "0711"],
    ["огурцы свежие", "0707"],
  ] as const)("cascade alias %s → %s", (q, prefix) => {
    const hit = matchClassifyAlias(q);
    expect(hit, q).toBeTruthy();
    expect(hit!.alias.code.replace(/\D/g, "").startsWith(prefix)).toBe(true);
  });

  it("огурец cascade is not apparel 61 / milk 0403 / headgear 65", () => {
    const hit = matchClassifyAlias("огурец");
    const digits = hit!.alias.code.replace(/\D/g, "");
    expect(digits.startsWith("0707")).toBe(true);
    expect(digits.startsWith("61") || digits.startsWith("0403") || digits.startsWith("65")).toBe(
      false,
    );
  });

  it("search: огурец scores produce title above футболка / майка rows", () => {
    const stems = tnvedSearchStems("огурец");
    const q = { stems, digits: "", phrase: "огурец" };
    const produce = scoreTnvedSearchHit(
      {
        code: "0707009001",
        titleRu: "Огурцы",
        notes: "огурцы свежие охлаждённые",
        isLeaf: true,
        level: 10,
      },
      q,
    );
    const tee = scoreTnvedSearchHit(
      {
        code: "6109100000",
        titleRu: "Футболки",
        notes: "майки, футболки трикотажные",
        isLeaf: true,
        level: 10,
      },
      q,
    );
    const tank = scoreTnvedSearchHit(
      {
        code: "6109100000",
        titleRu: "Майки",
        notes: "майка хлопок",
        isLeaf: true,
        level: 10,
      },
      q,
    );
    expect(produce).toBeGreaterThan(tee);
    expect(produce).toBeGreaterThan(tank);
    expect(tee).toBeLessThan(40);
  });
});
