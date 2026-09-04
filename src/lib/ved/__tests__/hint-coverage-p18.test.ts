/**
 * Cov-P18: offline closeout gate (no deploy).
 * Canon: docs/knowledge/plan-hint-gap-probe-run.md §6.6
 */
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it, beforeEach } from "vitest";
import { matchHintPack } from "../tnved-hint-trees";
import { classifyTnvedCascade } from "../tnved-classify";
import { resetClassifyIndexCache } from "../tnved-classify-index";

const dictionary = JSON.parse(
  readFileSync(path.join(__dirname, "hint-coverage-probe-dictionary.json"), "utf8"),
) as { rows: Array<{ id: string; query: string; live?: boolean; expected: { pack: string | null } }> };

const mockDb = {
  tnvedCode: { findUnique: async () => null, findMany: async () => [] },
} as never;

/** Observe metrics target (plan-s7); P19 closed residual MISS → miss 0. */
const FINAL_OBSERVE = {
  packPctMin: 90,
  anyPctMin: 98,
  missMax: 0,
  goldenRowsMin: 95,
  liveRowsMin: 28,
} as const;

describe("Cov-P18 — offline closeout fixtures", () => {
  it("golden dictionary at final size", () => {
    expect(dictionary.rows.length).toBeGreaterThanOrEqual(FINAL_OBSERVE.goldenRowsMin);
  });

  it("live subset expanded for post-deploy H5–H7", () => {
    const live = dictionary.rows.filter((r) => r.live);
    expect(live.length).toBeGreaterThanOrEqual(FINAL_OBSERVE.liveRowsMin);
    expect(live.map((r) => r.query)).toEqual(
      expect.arrayContaining([
        "галстук",
        "полка",
        "микрофон",
        "лыжи",
        "морс",
        "ореховое молоко",
      ]),
    );
  });
});

describe("Cov-P18 — live subset pack smoke (offline)", () => {
  it.each([
    ["полка", "bedroom-furniture"],
    ["лампа", "lamps"],
    ["микрофон", "peripherals"],
    ["steam deck", "gaming"],
    ["лыжи", "sports"],
    ["пицца", "prepared-food"],
  ] as const)("%s → %s", (q, pack) => {
    expect(matchHintPack(q)?.id).toBe(pack);
  });

  it("POLICY live rows stay pack-null; F5/C/E promotions are packs", () => {
    expect(matchHintPack("ореховое молоко")).toBeNull();
    expect(matchHintPack("галстук")?.id).toBe("tie-belt");
    expect(matchHintPack("морс")?.id).toBe("snacks");
  });
});

describe("Cov-P18 — live subset cascade smoke", () => {
  beforeEach(() => {
    resetClassifyIndexCache();
  });

  it("морс live row cascades to 2202 (alias still works with pack)", async () => {
    const hit = await classifyTnvedCascade(mockDb, { description: "морс" });
    expect(hit?.hsCode.replace(/\D/g, "").startsWith("2202")).toBe(true);
  });
});
