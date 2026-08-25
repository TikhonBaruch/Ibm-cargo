import { describe, it, expect } from "vitest";
import {
  cosineSimilarity,
  isPrecedentEmbeddingEnabled,
  resolveEmbedModel,
  toVectorLiteral,
  PRECEDENT_EMBED_DIM,
  PRECEDENT_VECTOR_THRESHOLD,
} from "../precedent-embeddings";

describe("precedent-embeddings", () => {
  it("cosineSimilarity is 1 for identical vectors", () => {
    const v = [0.1, 0.2, 0.3, 0.4];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("cosineSimilarity is 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it("toVectorLiteral pads to PRECEDENT_EMBED_DIM", () => {
    const lit = toVectorLiteral([1, 2]);
    const inner = lit.slice(1, -1).split(",");
    expect(inner.length).toBe(PRECEDENT_EMBED_DIM);
  });

  it("resolveEmbedModel picks nvidia on nvidia base url", () => {
    const prev = process.env.OPENAI_BASE_URL;
    process.env.OPENAI_BASE_URL = "https://integrate.api.nvidia.com/v1";
    delete process.env.PRECEDENT_EMBED_MODEL;
    expect(resolveEmbedModel()).toBe("nvidia/nv-embedqa-e5-v5");
    process.env.OPENAI_BASE_URL = prev;
  });

  it("isPrecedentEmbeddingEnabled respects PRECEDENT_VECTOR_ENABLED=0", () => {
    const prevKey = process.env.OPENAI_API_KEY;
    const prevFlag = process.env.PRECEDENT_VECTOR_ENABLED;
    process.env.OPENAI_API_KEY = "test-key";
    process.env.PRECEDENT_VECTOR_ENABLED = "0";
    expect(isPrecedentEmbeddingEnabled()).toBe(false);
    process.env.PRECEDENT_VECTOR_ENABLED = prevFlag;
    process.env.OPENAI_API_KEY = prevKey;
  });

  it("vector threshold default is reasonable", () => {
    expect(PRECEDENT_VECTOR_THRESHOLD).toBeGreaterThanOrEqual(0.5);
    expect(PRECEDENT_VECTOR_THRESHOLD).toBeLessThanOrEqual(1);
  });
});
