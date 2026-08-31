/**
 * P1: pack precision matrix — every C21 pack × positive / must-not.
 * Canon: docs/knowledge/plan-hint-chains-precision-audit.md §4–§6.
 */
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import overlay from "../tnved-hint-tree-packs.json";
import { hintTreeQuestions, matchHintPack } from "../tnved-hint-trees";

const fixturePath = path.join(__dirname, "hint-pack-precision.fixture.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  packs: Array<{ id: string; positive: string[]; mustNot: string[] }>;
  headingsPresent: Record<string, string[]>;
};

describe("P1 hint-pack precision matrix", () => {
  it("fixture covers every overlay pack", () => {
    const fixtureIds = new Set(fixture.packs.map((p) => p.id));
    const overlayIds = (overlay.packs || []).map((p) => p.id);
    expect(overlayIds.length).toBeGreaterThanOrEqual(14);
    for (const id of overlayIds) {
      expect(fixtureIds.has(id), `missing fixture row for pack ${id}`).toBe(true);
    }
  });

  for (const row of fixture.packs) {
    describe(`pack ${row.id}`, () => {
      it(`positive (≥${Math.min(3, row.positive.length)}) → ${row.id}`, () => {
        expect(row.positive.length).toBeGreaterThanOrEqual(3);
        for (const q of row.positive) {
          expect(matchHintPack(q)?.id, q).toBe(row.id);
        }
      });

      it(`mustNot (≥${Math.min(5, row.mustNot.length)}) → not ${row.id}`, () => {
        expect(row.mustNot.length).toBeGreaterThanOrEqual(5);
        for (const q of row.mustNot) {
          expect(matchHintPack(q)?.id, q).not.toBe(row.id);
        }
      });

      it("options expose hsHeading digits only", () => {
        const qs = hintTreeQuestions(row.positive[0]);
        expect(qs.length).toBeGreaterThanOrEqual(1);
        for (const o of qs[0].options) {
          expect(o.hsHeading).toMatch(/^\d{2,10}$/);
        }
      });
    });
  }

  it("produce-fresh exposes fresh/brine/pickle headings 0707/0711/2001", () => {
    const need = fixture.headingsPresent["produce-fresh"];
    const qs = hintTreeQuestions("огурец");
    const headings = qs[0].options.map((o) => o.hsHeading);
    for (const h of need) {
      expect(headings, h).toContain(h);
    }
  });

  it("огурец never lands knit-top / milk / headgear", () => {
    expect(matchHintPack("огурец")?.id).toBe("produce-fresh");
    expect(matchHintPack("огурцы")?.id).toBe("produce-fresh");
    expect(matchHintPack("корнишоны")?.id).toBe("produce-fresh");
    for (const bad of ["knit-top", "milk", "headgear", "footwear"] as const) {
      expect(matchHintPack("огурец")?.id).not.toBe(bad);
    }
  });

  it("P1 aggregate: 100% precision on golden positives + mustNot", () => {
    let posOk = 0;
    let posTotal = 0;
    let negOk = 0;
    let negTotal = 0;
    for (const row of fixture.packs) {
      for (const q of row.positive) {
        posTotal += 1;
        if (matchHintPack(q)?.id === row.id) posOk += 1;
      }
      for (const q of row.mustNot) {
        negTotal += 1;
        if (matchHintPack(q)?.id !== row.id) negOk += 1;
      }
    }
    expect(posTotal).toBeGreaterThan(0);
    expect(negTotal).toBeGreaterThan(0);
    expect(posOk / posTotal).toBe(1);
    expect(negOk / negTotal).toBe(1);
  });
});
