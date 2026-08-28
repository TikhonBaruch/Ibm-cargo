import { describe, expect, it, vi, beforeEach } from "vitest";
import { matchClassifyAlias, scoreClassifyAlias } from "../tnved-classify-aliases";
import {
  classifyByTokenIndex,
  confFromAliasScore,
  resetClassifyIndexCache,
} from "../tnved-classify-index";
import {
  buildClassificationQuery,
  classificationText,
  isGenericProductTitle,
} from "../product-classify-text";
import {
  CASCADE_CONF_THRESHOLD,
  classifyTnvedCascade,
  pickCascadeOrHeuristic,
} from "../tnved-classify";
import fixture from "./classify-cascade.fixture.json";
import { buildHeuristicDraft } from "../ai-draft-engine";

function mockDb() {
  return {
    tnvedCode: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as never;
}

describe("product-classify-text", () => {
  it("merges clarify answers into classificationText", () => {
    const desc = "Молоко\n\nУточнения (ИИ):\n1) Вид\nОтвет: сухое";
    expect(classificationText(desc)).toContain("сухое");
  });

  it("buildClassificationQuery prefers OCR when title generic", () => {
    const q = buildClassificationQuery("новый товар", { ocrText: "Wireless earbuds Bluetooth" });
    expect(q.toLowerCase()).toMatch(/earbud|wireless/);
  });
});

describe("tnved-classify-aliases", () => {
  it("matches invoice alias 充电宝", () => {
    const hit = matchClassifyAlias("充电宝 power bank");
    expect(hit?.alias.code).toMatch(/^850760/);
    expect(confFromAliasScore(hit!.score)).toBeGreaterThanOrEqual(0.84);
  });

  it("exclude blocks tablet for laptop alias", () => {
    const laptop = scoreClassifyAlias("ipad tablet планшет", {
      code: "8471300000",
      keys: ["ноутбук", "laptop"],
      exclude: ["планшет", "tablet", "ipad"],
      why: "laptop",
      risk: "low",
    });
    expect(laptop).toBe(0);
  });

  it("C31c: smartwatch → 8517 62, not quartz 91", () => {
    const smart = matchClassifyAlias("smartwatch");
    expect(smart?.alias.code).toMatch(/^851762/);
    const quartz = matchClassifyAlias("wrist watch quartz");
    expect(quartz?.alias.code).toMatch(/^910211/);
  });
});

describe("classifyTnvedCascade", () => {
  beforeEach(() => {
    resetClassifyIndexCache();
  });

  it.each(fixture as Array<{ q: string; expectHsPrefix: string; minConf: number; mustNotMatch?: string }>)(
    "fixture: $q",
    async ({ q, expectHsPrefix, minConf, mustNotMatch }) => {
      const hit = await classifyTnvedCascade(mockDb(), { description: q });
      if (mustNotMatch) {
        if (!hit) return;
        expect(hit.hsCode.replace(/\D/g, "").startsWith(mustNotMatch.replace(/\D/g, ""))).toBe(false);
        return;
      }
      expect(hit).not.toBeNull();
      expect(hit!.hsCode.replace(/\D/g, "").startsWith(expectHsPrefix.replace(/\D/g, ""))).toBe(true);
      expect(hit!.confidence).toBeGreaterThanOrEqual(minConf);
    }
  );

  it("token index matches ноутбук when index file present", () => {
    const hit = classifyByTokenIndex("игровой ноутбук lenovo thinkpad");
    if (!hit) return;
    expect(hit.code).toMatch(/^8471/);
  });
});

describe("pickCascadeOrHeuristic", () => {
  it("prefers cascade when confidence beats heuristic", () => {
    const cascade = {
      hsCode: "8507 60 000 0",
      confidence: 0.88,
      disclaimer: "cascade",
      duties: { customsDutyPercent: 0, vatPercent: 22, feeRub: 1000 },
      documents: [],
      engine: "cascade-v1",
    };
    const heuristic = buildHeuristicDraft({ description: "прочее xyz оборудование" });
    const picked = pickCascadeOrHeuristic(cascade, heuristic);
    expect(picked.engine).toBe("cascade-v1");
    expect(picked.confidence).toBeGreaterThanOrEqual(CASCADE_CONF_THRESHOLD);
  });
});

describe("isGenericProductTitle", () => {
  it("flags placeholder titles", () => {
    expect(isGenericProductTitle("новый товар")).toBe(true);
    expect(isGenericProductTitle("Кроссовки Nike Air")).toBe(false);
  });
});
