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
    const out = await waitForAiEnrich(
      { id: "c1", aiDrainPending: true, aiDraft: { llmEnrichPending: true } },
      async () => {
        n += 1;
        if (n < 2) return { id: "c1", aiDraft: { llmEnrichPending: true } };
        return {
          id: "c1",
          aiDraft: { llmEnrichPending: false, llmEnrich: "llm-openai-v1", hsCode: "6109 10 000 0" },
        };
      },
      { intervalMs: 5, timeoutMs: 500 }
    );
    expect(n).toBe(2);
    expect((out.aiDraft as { llmEnrich?: string }).llmEnrich).toBe("llm-openai-v1");
  });
});
