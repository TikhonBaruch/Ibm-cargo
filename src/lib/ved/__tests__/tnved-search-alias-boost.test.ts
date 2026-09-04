/**
 * Search alias boost: морс≠морская, HDD→8471.
 * Canon: docs/knowledge/plan-tnved-search-alias-boost.md
 */
import { describe, expect, it, vi } from "vitest";
import { resolveTnvedSearchAlias } from "../tnved-query-match";
import { scoreTnvedSearchHit, searchTnvedCodes, tnvedSearchStems } from "../tnved";

describe("resolveTnvedSearchAlias", () => {
  it("морс → 2202; морская does not fire", () => {
    expect(resolveTnvedSearchAlias("морс")?.codePrefix).toBe("2202");
    expect(resolveTnvedSearchAlias("Морсы")?.codePrefix).toBe("2202");
    expect(resolveTnvedSearchAlias("морская вода")).toBeNull();
  });

  it("HDD / жесткий диск / ноутбук → chapter boost", () => {
    expect(resolveTnvedSearchAlias("HDD")?.codePrefix).toBe("8471");
    expect(resolveTnvedSearchAlias("hdd")?.codePrefix).toBe("8471");
    expect(resolveTnvedSearchAlias("жесткий диск")?.codePrefix).toBe("8471");
    expect(resolveTnvedSearchAlias("ноутбук")?.codePrefix).toBe("847130");
  });
});

describe("scoreTnvedSearchHit whole-word / notes clarification", () => {
  it("ноутбук ranks 847130 over bamboo notes hitchhike", () => {
    const stems = tnvedSearchStems("ноутбук");
    const laptop = scoreTnvedSearchHit(
      {
        code: "8471300000",
        titleRu: "машины вычислительные портативные массой не более 10 кг",
        notes: null,
        isLeaf: true,
        level: 10,
      },
      { stems, digits: "", phrase: "ноутбук" },
    );
    const bamboo = scoreTnvedSearchHit(
      {
        code: "4421910000",
        titleRu: "Из бамбука",
        notes:
          "подставка, предназначенная для удобного размещения и охлаждения ноутбука, планшета",
        isLeaf: true,
        level: 10,
      },
      { stems, digits: "", phrase: "ноутбук" },
    );
    expect(laptop).toBeGreaterThan(bamboo);
  });

  it("short stem поло does not score title Половины", () => {
    const meat = scoreTnvedSearchHit(
      { code: "0207132000", titleRu: "Половины или четвертины", notes: null, isLeaf: true, level: 10 },
      { stems: ["поло"], digits: "", phrase: "поло" },
    );
    const polo = scoreTnvedSearchHit(
      {
        code: "6105100000",
        titleRu: "Из хлопчатобумажной пряжи",
        notes: "polo, поло",
        isLeaf: true,
        level: 10,
      },
      { stems: ["поло"], digits: "", phrase: "поло" },
    );
    expect(polo).toBeGreaterThan(meat);
  });
});

describe("scoreTnvedSearchHit alias boost", () => {
  it("морс ranks 2202 drink over 2501 морская", () => {
    const stems = tnvedSearchStems("морс");
    const drink = scoreTnvedSearchHit(
      {
        code: "2202991900",
        titleRu: "Прочие",
        notes: "напитки безалкогольные, морс",
        isLeaf: true,
        level: 10,
      },
      { stems, digits: "", phrase: "морс" },
    );
    const seawater = scoreTnvedSearchHit(
      {
        code: "2501001000",
        titleRu: "Вода морская и солевые растворы",
        notes: null,
        isLeaf: true,
        level: 10,
      },
      { stems, digits: "", phrase: "морс" },
    );
    expect(drink).toBeGreaterThan(seawater);
  });

  it("HDD ranks 8471 storage over unrelated leaf", () => {
    const stems = ["hdd", "жестк", "накопител", "винчестер"];
    const hdd = scoreTnvedSearchHit(
      {
        code: "8471705000",
        titleRu: "Накопители на жестких магнитных дисках",
        notes: "HDD",
        isLeaf: true,
        level: 10,
      },
      { stems, digits: "", phrase: "HDD" },
    );
    const other = scoreTnvedSearchHit(
      {
        code: "8517620000",
        titleRu: "Аппараты для передачи данных",
        notes: null,
        isLeaf: true,
        level: 10,
      },
      { stems, digits: "", phrase: "HDD" },
    );
    expect(hdd).toBeGreaterThan(other);
  });
});

describe("searchTnvedCodes alias pool", () => {
  it("HDD OR includes code prefix 8471 even without title hit", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        code: "8471705000",
        titleRu: "Накопители на жестких магнитных дисках",
        notes: null,
        isLeaf: true,
        level: 10,
      },
    ]);
    await searchTnvedCodes({ tnvedCode: { findMany } } as never, { q: "HDD", limit: 5 });
    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: { startsWith: "8471" } })]),
    );
  });

  it("морс OR includes code prefix 2202", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await searchTnvedCodes({ tnvedCode: { findMany } } as never, { q: "морс", limit: 5 });
    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: { startsWith: "2202" } })]),
    );
  });
});
