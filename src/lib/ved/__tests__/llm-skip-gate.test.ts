import { describe, expect, it, afterEach, vi } from "vitest";
import {
  applyLlmSkipToDraft,
  llmSkipConfidenceThreshold,
  resolveOfflineClassifyEngine,
  shouldSkipLlmClassify,
} from "../llm-skip-gate";
import type { AiDraftResult } from "../domain";

const base: AiDraftResult = {
  hsCode: "0707 00 900 1",
  duties: { customsDutyPercent: 0, vatPercent: 10, feeRub: 0 },
  documents: [],
  confidence: 0.9,
  disclaimer: "test",
  engine: "cascade-v1",
};

describe("llm-skip-gate (C35a)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("default LLM_SKIP_CONF is 0.72", () => {
    expect(llmSkipConfidenceThreshold({})).toBe(0.72);
  });

  it("skips LLM for cascade-v1 at/above threshold", () => {
    const d = shouldSkipLlmClassify(base, {});
    expect(d.skip).toBe(true);
    expect(d.skipReason).toBe("offline-hit:cascade-v1");
    expect(applyLlmSkipToDraft(base, d).skipReason).toBe("offline-hit:cascade-v1");
    expect(applyLlmSkipToDraft(base, d).llmEnrich).toBe("cascade-v1");
  });

  it("skips LLM for precedent via llmEnrich even if engine is heuristic", () => {
    const draft = {
      ...base,
      engine: "heuristic-v1",
      llmEnrich: "precedent-v1",
      confidence: 0.95,
    };
    expect(resolveOfflineClassifyEngine(draft)).toBe("precedent-v1");
    const d = shouldSkipLlmClassify(draft, {});
    expect(d.skip).toBe(true);
    expect(d.skipReason).toBe("offline-hit:precedent-v1");
  });

  it("does not skip heuristic-only drafts", () => {
    const d = shouldSkipLlmClassify(
      { ...base, engine: "heuristic-v1", confidence: 0.99 },
      {}
    );
    expect(d.skip).toBe(false);
    expect(d.skipReason).toBeUndefined();
  });

  it("does not skip offline engine below threshold (llm-low-conf)", () => {
    const d = shouldSkipLlmClassify({ ...base, confidence: 0.6 }, {});
    expect(d.skip).toBe(false);
    expect(d.skipReason).toBe("llm-low-conf:cascade-v1");
  });

  it("honours LLM_SKIP_CONF env", () => {
    const d = shouldSkipLlmClassify({ ...base, confidence: 0.8 }, {
      LLM_SKIP_CONF: "0.85",
    });
    expect(d.skip).toBe(false);
    expect(d.threshold).toBe(0.85);
  });
});
