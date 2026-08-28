import { describe, expect, it } from "vitest";
import overlay from "../tnved-relations.json";
import {
  relationFocusCodes,
  relationsAsSearchExtras,
  relationsForCode,
} from "../tnved-relations";
import { assembleTnvedCard } from "../tnved";

describe("C20 TNVED relations overlay", () => {
  it("only links existing 2-10 digit codes and known kinds", () => {
    const kinds = new Set(["not", "variant", "part", "kit"]);
    for (const edge of overlay.edges) {
      expect(edge.from).toMatch(/^\d{2,10}$/);
      expect(edge.to).toMatch(/^\d{2,10}$/);
      expect(kinds.has(edge.kind)).toBe(true);
      expect(edge.why.length).toBeGreaterThan(8);
    }
  });

  it("indexes FTS coil vs cartridge both ways", () => {
    const fromVape = relationsForCode("8543400000");
    const fromPart = relationsForCode("8543 90 000 0");
    expect(fromVape.some((r) => r.code === "8543900000" && r.kind === "part")).toBe(true);
    expect(fromPart.some((r) => r.code === "8543400000" && r.kind === "part")).toBe(true);
  });

  it("packs peer codes into search extras without inventing a why lead", () => {
    const extras = relationsAsSearchExtras();
    expect(extras.get("8507600000")?.tokens).toEqual(expect.arrayContaining(["8504405500", "не путать"]));
    expect(extras.get("8507600000")?.why).toEqual([]);
    expect(relationFocusCodes()).toEqual(expect.arrayContaining(["8543400000", "6109100000"]));
  });

  it("attaches related on the card envelope", () => {
    const card = assembleTnvedCard({
      row: {
        code: "8543400000",
        codeDisplay: "8543 40 000 0",
        titleRu: "сигареты электронные",
        isLeaf: true,
        level: 10,
        notes: null,
        rates: [],
      },
      ancestors: [],
    });
    expect(card.related.map((r) => r.code)).toContain("8543900000");
    expect(card.children).toEqual([]);
  });
});
