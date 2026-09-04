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

  it("HDD / жесткий диск → 8471", () => {
    expect(resolveTnvedSearchAlias("HDD")?.codePrefix).toBe("8471");
    expect(resolveTnvedSearchAlias("hdd")?.codePrefix).toBe("8471");
    expect(resolveTnvedSearchAlias("жесткий диск")?.codePrefix).toBe("8471");
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
