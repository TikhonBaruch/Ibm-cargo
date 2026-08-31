import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it, beforeEach } from "vitest";
import { resetClassifyIndexCache } from "../tnved-classify-index";
import { classifyTnvedCascade } from "../tnved-classify";

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
});
