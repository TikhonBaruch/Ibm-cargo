import { describe, expect, it } from "vitest";
import overlay from "../tnved-hint-tree-packs.json";
import {
  hintTreeFocusCodes,
  hintTreeQuestions,
  matchHintPack,
} from "../tnved-hint-trees";

describe("C21 TNVED hint trees", () => {
  it("packs only point at 2-10 digit headings", () => {
    expect(overlay.packs.length).toBeGreaterThanOrEqual(12);
    for (const pack of overlay.packs) {
      expect(pack.triggers.length).toBeGreaterThan(0);
      for (const o of pack.question.options) {
        expect(o.hsHeading).toMatch(/^\d{2,10}$/);
      }
    }
    expect(hintTreeFocusCodes()).toEqual(expect.arrayContaining(["0401", "040210", "040299", "0403"]));
  });

  it("matches milk family and does not invent a pasteurization code", () => {
    expect(matchHintPack("молоко")?.id).toBe("milk");
    const qs = hintTreeQuestions("молоко");
    expect(qs).toHaveLength(1);
    const labels = qs[0].options.map((o) => o.label);
    expect(labels.join(" ")).toMatch(/Питьевое/);
    expect(labels.join(" ")).toMatch(/Сухое/);
    expect(labels.join(" ")).toMatch(/Сгущённое/);
    const pasteurized = qs[0].options.find((o) => o.id === "fresh");
    expect(pasteurized?.hsHeading).toBe("0401");
    expect(qs[0].options.every((o) => o.hsHeading !== "pasteurized")).toBe(true);
  });

  it("maps dry milk to 040210 and condensed to 040299", () => {
    const qs = hintTreeQuestions("молоко");
    expect(qs[0].options.find((o) => o.id === "powder")?.hsHeading).toBe("040210");
    expect(qs[0].options.find((o) => o.id === "condensed")?.hsHeading).toBe("040299");
    expect(qs[0].options.find((o) => o.id === "fermented")?.hsHeading).toBe("0403");
  });

  it("does not steal socks from apparel clarify", () => {
    expect(matchHintPack("носки")).toBeNull();
    expect(hintTreeQuestions("носки")).toEqual([]);
  });
});
