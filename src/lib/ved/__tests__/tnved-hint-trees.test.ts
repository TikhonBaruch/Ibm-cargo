import { describe, expect, it } from "vitest";
import overlay from "../tnved-hint-tree-packs.json";
import {
  hintTreeFocusCodes,
  hintTreeHeadingForAnswer,
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

  it("headgear pack maps кепка to 6505003000", () => {
    expect(matchHintPack("кепка")?.id).toBe("headgear");
    const qs = hintTreeQuestions("кепка");
    expect(qs[0].options.find((o) => o.id === "cap")?.hsHeading).toBe("6505003000");
    expect(qs[0].options.find((o) => o.id === "hat")?.hsHeading).toBe("6505009000");
  });

  it("P2: hintTreeHeadingForAnswer maps produce fork by option id/value/label", () => {
    expect(hintTreeHeadingForAnswer("огурец", "tnved-form", "fresh")).toBe("0707");
    expect(hintTreeHeadingForAnswer("огурец", "tnved-form", "preserved")).toBe("0711");
    expect(hintTreeHeadingForAnswer("огурец", "tnved-form", "prepared")).toBe("2001");
    expect(
      hintTreeHeadingForAnswer("огурец", "tnved-form", "овощи готовые консервы"),
    ).toBe("2001");
    expect(
      hintTreeHeadingForAnswer("огурец", "tnved-form", "Готовые / консервы"),
    ).toBe("2001");
    expect(hintTreeHeadingForAnswer("майка", "tnved-form", "fresh")).not.toBe("0707");
  });
});
