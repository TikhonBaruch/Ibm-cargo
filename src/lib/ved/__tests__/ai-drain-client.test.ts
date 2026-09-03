import { describe, expect, it } from "vitest";
import { isAiDrainPending, waitForAiEnrich } from "../ai-drain-client";

describe("ai-drain-client", () => {
  it("detects pending from aiDraft or aiDrainPending", () => {
    expect(isAiDrainPending({ aiDrainPending: true })).toBe(true);
    expect(isAiDrainPending({ aiDraft: { llmEnrichPending: true } })).toBe(true);
    expect(isAiDrainPending({ aiDraft: { llmEnrich: "llm-openai-v1" } })).toBe(false);
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

  it("payAfter-sized timeout returns while still pending (C39)", async () => {
    type Calc = { id: string; aiDraft?: { llmEnrichPending?: boolean } };
    const seed: Calc = { id: "c2", aiDraft: { llmEnrichPending: true } };
    let polls = 0;
    const out = await waitForAiEnrich(
      seed,
      async () => {
        polls += 1;
        return { id: "c2", aiDraft: { llmEnrichPending: true } } satisfies Calc;
      },
      { intervalMs: 20, timeoutMs: 50 }
    );
    expect(polls).toBeGreaterThanOrEqual(1);
    expect(isAiDrainPending(out)).toBe(true);
  });
});
