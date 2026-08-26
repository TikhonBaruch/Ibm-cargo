import { describe, expect, it } from "vitest";
import {
  detectCategory,
  detectComposition,
  gapTipLabels,
  heuristicClarificationQuestions,
  newCalcClarifyQuestions,
  truncateClarifyQuestions,
} from "../clarify-hints";

describe("clarify-hints detect", () => {
  it("detects socks as apparel", () => {
    expect(detectCategory("носки белые из хлопка")).toBe("apparel");
  });

  it("detects sneakers typo as footwear", () => {
    expect(detectCategory("кросовки")).toBe("footwear");
  });

  it("detects laptop as electronics", () => {
    expect(detectCategory("ноутбук Lenovo ThinkPad")).toBe("electronics");
  });

  it("detects composition in text", () => {
    expect(detectComposition("носки белые из хлопка")).toBe(true);
    expect(detectComposition("кросовки")).toBe(false);
  });
});

describe("clarify-hints gaps / questions", () => {
  it("omits composition chip when cotton already in desc", () => {
    const qs = newCalcClarifyQuestions("носки белые из хлопка");
    expect(qs.some((q) => q.id === "composition")).toBe(false);
    expect(qs.some((q) => q.id === "knit-woven")).toBe(true);
  });

  it("asks upper/sole/purpose for short sneakers", () => {
    const qs = newCalcClarifyQuestions("кросовки");
    const ids = qs.map((q) => q.id);
    expect(ids).toContain("upper");
    expect(ids).toContain("sole");
    expect(ids).toContain("purpose");
    expect(qs.length).toBeLessThanOrEqual(3);
  });

  it("truncates to max 3 and keeps docs last", () => {
    const many = [
      { id: "a", text: "A", required: false },
      { id: "b", text: "B", required: false },
      { id: "c", text: "C", required: false },
      { id: "docs", text: "Docs?", required: false },
      { id: "e", text: "E", required: false },
    ];
    const trimmed = truncateClarifyQuestions(many);
    expect(trimmed).toHaveLength(3);
    expect(trimmed.map((q) => q.id)).toEqual(["a", "b", "docs"]);
  });

  it("NewCalc path has no docs question", () => {
    const qs = newCalcClarifyQuestions("кросовки nike");
    expect(qs.every((q) => q.id !== "docs")).toBe(true);
  });

  it("lab heuristic can include docs when coreReady", () => {
    const qs = heuristicClarificationQuestions({
      desc: "футболка 100% хлопок трикотаж чёрная мужская Nike",
      step: 1,
      hasDocs: false,
      includeDocsQuestion: true,
    });
    // long ready apparel may include docs among ≤3
    expect(qs.length).toBeLessThanOrEqual(3);
  });

  it("gapTipLabels for footwear short desc", () => {
    const labels = gapTipLabels("кросовки", "footwear");
    expect(labels).toEqual(expect.arrayContaining(["верх", "подошва", "назначение"]));
  });
});
