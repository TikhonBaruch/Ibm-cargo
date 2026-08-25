import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../settings", () => ({
  getPlatformSettings: vi.fn().mockResolvedValue({
    llmEnrichEnabled: true,
    paymentsEnabled: true,
    notifyEnabled: true,
    mockTopupAllowed: true,
  }),
}));

import { requestAiDraft } from "../ai";
import { enrichWithLlm } from "../../../../containers/ai/src/enrich-llm.js";

const baseDraft = {
  hsCode: "8471 30 000 0",
  confidence: 0.9,
  duties: {
    customsDutyPercent: 0,
    vatPercent: 22,
    feeRub: 500,
    note: "heuristic",
  },
  documents: [] as string[],
  disclaimer: "heuristic-v1",
  engine: "heuristic-v1",
};

describe("S6 enrichWithLlm fail-open", () => {
  it("returns heuristic draft when LLM_SERVICE_URL unset", async () => {
    const out = await enrichWithLlm({ description: "ноутбук" }, baseDraft, { llmUrl: "" });
    expect(out).toEqual(baseDraft);
    expect(out).not.toHaveProperty("llmEnrich");
  });

  it("returns heuristic draft when classify/duty fetch throws", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("llm down"));
    const out = await enrichWithLlm({ description: "ноутбук" }, baseDraft, {
      llmUrl: "http://llm:4500",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(out).toEqual(baseDraft);
    expect(out).not.toHaveProperty("llmEnrich");
  });

  it("returns heuristic draft when classify responds non-OK", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("err", { status: 503 }));
    const out = await enrichWithLlm({ description: "ноутбук" }, baseDraft, {
      llmUrl: "http://llm:4500",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(out).toEqual(baseDraft);
  });

  it("merges classify when LLM succeeds", async () => {
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/classify")) {
        return new Response(
          JSON.stringify({
            hsCode: "8517 12 000 0",
            confidence: 0.77,
            engine: "llm-stub-v0",
            disclaimer: "llm-stub",
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({ customsDutyPercent: 5, vatPercent: 22, feeRub: 1000 }),
        { status: 200 }
      );
    });
    const out = await enrichWithLlm({ description: "телефон" }, baseDraft, {
      llmUrl: "http://llm:4500",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(out.hsCode).toBe("8517 12 000 0");
    expect(out.confidence).toBe(0.77);
    expect((out as { llmEnrich?: string }).llmEnrich).toBe("llm-stub-v0");
    expect(out.engine).toBe("heuristic-v1");
  });
});

describe("requestAiDraft fail-open (create must not fail)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("falls back to heuristic when AI_SERVICE_URL fetch fails", async () => {
    vi.stubEnv("AI_SERVICE_URL", "http://ai:4100");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ai down")));
    const d = await requestAiDraft({ description: "Игровой ноутбук 16\"" });
    expect(d.engine).toBe("heuristic-v1");
    expect(d.hsCode).toBeTruthy();
  });

  it("falls back to heuristic when AI_SERVICE_URL returns non-OK", async () => {
    vi.stubEnv("AI_SERVICE_URL", "http://ai:4100");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    const d = await requestAiDraft({ description: "Игровой ноутбук 16\"" });
    expect(d.engine).toBe("heuristic-v1");
    expect(d.hsCode).toBe("8471 30 000 0");
  });
});
