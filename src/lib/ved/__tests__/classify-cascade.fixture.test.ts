import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it, beforeEach } from "vitest";
import { resetClassifyIndexCache } from "../tnved-classify-index";
import { classifyTnvedCascade } from "../tnved-classify";
import { shouldSkipLlmClassify } from "../llm-skip-gate";

const fixturePath = path.join(__dirname, "classify-cascade.fixture.json");
const cases = JSON.parse(readFileSync(fixturePath, "utf8")) as Array<{
  q: string;
  expectHsPrefix: string;
  minConf: number;
  mustNotMatch?: string;
}>;

const mockDb = {
  tnvedCode: {
    findUnique: async () => null,
    findMany: async () => [],
  },
} as never;

/** C35e §6: sync offline hit on must-cover (positive rows only). */
const OFFLINE_HIT_TARGET = 0.6;
const LLM_CALL_CAP = 0.4;

describe("classify-cascade fixture suite (C27)", () => {
  beforeEach(() => {
    resetClassifyIndexCache();
  });

  for (const row of cases) {
    it(row.q.slice(0, 60), async () => {
      const hit = await classifyTnvedCascade(mockDb, { description: row.q });
      if (row.mustNotMatch) {
        if (!hit) return;
        expect(hit.hsCode.replace(/\D/g, "").startsWith(row.mustNotMatch.replace(/\D/g, ""))).toBe(false);
        return;
      }
      expect(hit).not.toBeNull();
      expect(hit!.hsCode.replace(/\D/g, "").startsWith(row.expectHsPrefix.replace(/\D/g, ""))).toBe(true);
      expect(hit!.confidence).toBeGreaterThanOrEqual(row.minConf);
    });
  }

  it("C35e: sync offline-hit ≥ 60% and LLM-bound ≤ 40% on must-cover", async () => {
    let scored = 0;
    let offlineHits = 0;
    let wouldCallLlm = 0;

    for (const row of cases) {
      if (row.mustNotMatch) continue;
      scored += 1;
      const hit = await classifyTnvedCascade(mockDb, { description: row.q });
      if (!hit) {
        wouldCallLlm += 1;
        continue;
      }
      const skip = shouldSkipLlmClassify({
        engine: hit.engine,
        llmEnrich: hit.engine,
        confidence: hit.confidence,
      });
      if (skip.skip) offlineHits += 1;
      else wouldCallLlm += 1;
    }

    expect(scored).toBeGreaterThan(0);
    const offlineRate = offlineHits / scored;
    const llmRate = wouldCallLlm / scored;
    expect(offlineRate).toBeGreaterThanOrEqual(OFFLINE_HIT_TARGET);
    expect(llmRate).toBeLessThanOrEqual(LLM_CALL_CAP);
  });
});
