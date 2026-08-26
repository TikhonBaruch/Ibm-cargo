import { describe, expect, it, vi } from "vitest";
import {
  extractClarifyAnswersFromText,
  applyOptionWeights,
  reweightClarifyHints,
  searchClarifyProductProfiles,
} from "../clarify-hints/learning";
import type { ClarifyOption } from "../clarify-hints/types";

describe("clarify-hints learning P2", () => {
  it("extracts answers from Уточнения block", () => {
    const desc = `кроссовки\n\nУточнения (ИИ):\n1) Верх\nОтвет: верх текстиль\n\n2) Подошва\nОтвет: подошва резина`;
    const a = extractClarifyAnswersFromText(desc);
    expect(Object.values(a)).toEqual(
      expect.arrayContaining(["верх текстиль", "подошва резина"])
    );
  });

  it("applyOptionWeights sorts by DB weight", async () => {
    const options: ClarifyOption[] = [
      { id: "a", label: "A", searchValue: "a" },
      { id: "b", label: "B", searchValue: "b" },
      { id: "c", label: "C", searchValue: "c" },
    ];
    const db = {
      clarifyAttributeOption: {
        findMany: vi.fn().mockResolvedValue([
          { optionId: "c", weight: 5 },
          { optionId: "a", weight: 2 },
        ]),
      },
    };
    const ranked = await applyOptionWeights(db as never, "footwear", "upper", options);
    expect(ranked.map((o) => o.id)).toEqual(["c", "a", "b"]);
  });

  it("reweightClarifyHints upserts edges from feedback", async () => {
    const updates: unknown[] = [];
    const upserts: unknown[] = [];
    const db = {
      clarifyHsFeedback: {
        findMany: vi.fn().mockResolvedValue([
          {
            category: "footwear",
            answersJson: { upper: "верх текстиль", sole: "подошва резина" },
            tokens: "верх текстиль подошва резина",
          },
          {
            category: "footwear",
            answersJson: { upper: "верх текстиль" },
            tokens: null,
          },
        ]),
      },
      clarifyAttributeOption: {
        findMany: vi.fn().mockResolvedValue([
          { id: "opt1", pickCount: 0, weight: 1 },
        ]),
        update: vi.fn(async (args: unknown) => {
          updates.push(args);
        }),
      },
      clarifyDependencyEdge: {
        upsert: vi.fn(async (args: unknown) => {
          upserts.push(args);
        }),
      },
    };
    const result = await reweightClarifyHints(db as never);
    expect(result.feedback).toBe(2);
    expect(result.optionsUpdated).toBeGreaterThan(0);
    expect(result.edgesUpserted).toBeGreaterThan(0);
    expect(upserts.length).toBeGreaterThan(0);
  });

  it("searchClarifyProductProfiles maps rows", async () => {
    const db = {
      clarifyProductProfile: {
        findMany: vi.fn().mockResolvedValue([
          {
            canonicalText: "кроссовки текстиль резина",
            usageCount: 4,
            confidence: 0.7,
            hsCodeDigits: "6404110000",
            category: "footwear",
          },
        ]),
      },
    };
    const hits = await searchClarifyProductProfiles(db as never, "кросс", 5);
    expect(hits).toHaveLength(1);
    expect(hits[0].hsCodeDigits).toBe("6404110000");
    expect(hits[0].score).toBeGreaterThan(0.5);
  });
});
