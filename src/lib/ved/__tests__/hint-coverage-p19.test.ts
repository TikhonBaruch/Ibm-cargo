/**
 * Cov-P19: residual DEFER thin triggers + industrial POLICY.
 * Canon: docs/knowledge/plan-hint-gap-probe-run.md §6.7
 */
import { describe, expect, it } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";

describe("Cov-P19 — residual home / med / pet / cleaning", () => {
  it.each([
    ["вешалка", "home-textiles"],
    ["корзина для белья", "home-textiles"],
    ["маска медицинская", "med-disposables"],
    ["медицинская маска", "med-disposables"],
    ["миска для животных", "pet-accessories"],
    ["бумага туалетная", "cleaning"],
  ] as const)("%s → %s", (q, pack) => {
    expect(matchHintPack(q)?.id).toBe(pack);
  });

  it("bare tokens stay null (no hitchhike)", () => {
    expect(matchHintPack("корзина")).toBeNull();
    expect(matchHintPack("миска")).toBeNull();
    expect(matchHintPack("маска")).toBeNull();
  });
});

describe("Cov-P19 — industrial POLICY stay null", () => {
  it.each(["труба", "арматура"] as const)("%s POLICY null", (q) => {
    expect(matchHintPack(q)).toBeNull();
  });
});
