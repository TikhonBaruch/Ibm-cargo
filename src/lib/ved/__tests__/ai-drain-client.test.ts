import { describe, expect, it } from "vitest";
import {
  AI_ENRICH_BEFORE_PAY_MS,
  AI_ENRICH_WAIT_MS,
  isAiDrainPending,
  waitForAiEnrich,
} from "../ai-drain-client";

describe("ai-drain-client", () => {
  it("detects pending from aiDraft or aiDrainPending", () => {
    expect(isAiDrainPending({ aiDrainPending: true })).toBe(true);
    expect(isAiDrainPending({ aiDraft: { llmEnrichPending: true } })).toBe(true);
    expect(isAiDrainPending({ aiDraft: { llmEnrich: "llm-openai-v1" } })).toBe(false);
  });

  it("P0: before-pay enrich cap is much shorter than full drain wait", () => {
    expect(AI_ENRICH_BEFORE_PAY_MS).toBe(15_000);
    expect(AI_ENRICH_BEFORE_PAY_MS).toBeLessThan(AI_ENRICH_WAIT_MS);
  });

  it("polls until pending clears", async () => {
    let n = 0;
    type Calc = {
      id: string;
      aiDrainPending?: boolean;
      aiDraft?: { llmEnrichPending?: boolean; llmEnrich?: string; hsCode?: string };
    };
    const seed: Calc = { id: "c1", aiDrainPending: true, aiDraft: { llmEnrichPending: true } };
    const out = await waitForAiEnrich(
      seed,
      async () => {
        n += 1;
        if (n < 2) return { id: "c1", aiDraft: { llmEnrichPending: true } } satisfies Calc;
        return {
          id: "c1",
          aiDraft: { llmEnrichPending: false, llmEnrich: "llm-openai-v1", hsCode: "6109 10 000 0" },
        } satisfies Calc;
      },
      { intervalMs: 5, timeoutMs: 500 }
    );
    expect(n).toBe(2);
    expect((out.aiDraft as { llmEnrich?: string }).llmEnrich).toBe("llm-openai-v1");
  });

  it("P0: payAfter-style short timeout returns while still pending", async () => {
    type Calc = { id: string; aiDrainPending?: boolean; aiDraft?: { llmEnrichPending?: boolean } };
    const seed: Calc = { id: "c2", aiDrainPending: true, aiDraft: { llmEnrichPending: true } };
    const started = Date.now();
    const out = await waitForAiEnrich(
      seed,
      async () => ({ id: "c2", aiDrainPending: true, aiDraft: { llmEnrichPending: true } }),
      { intervalMs: 20, timeoutMs: 80 }
    );
    expect(Date.now() - started).toBeLessThan(400);
    expect(isAiDrainPending(out)).toBe(true);
  });
});
