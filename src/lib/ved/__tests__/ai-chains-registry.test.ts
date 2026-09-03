import { describe, expect, it } from "vitest";
import {
  AI_CHAINS,
  classifyEnvForChain,
  resolveAiChainId,
} from "../chains";

describe("AI chains registry", () => {
  it("defaults to chain 3 (deepseek vision + classify)", () => {
    expect(resolveAiChainId({})).toBe(3);
    expect(AI_CHAINS[3].slug).toBe("deepseek");
  });

  it("resolves numeric and slug aliases", () => {
    expect(resolveAiChainId({ AI_CHAIN_ID: "1" })).toBe(1);
    expect(resolveAiChainId({ AI_CHAIN_ID: "nvidia" })).toBe(1);
    expect(resolveAiChainId({ AI_CHAIN_ID: "3" })).toBe(3);
    expect(resolveAiChainId({ AI_CHAIN_ID: "deepseek" })).toBe(3);
    expect(resolveAiChainId({ LLM_CHAIN_ID: "hybrid" })).toBe(2);
  });

  it("forces deepseek-only classify env on chain 3", () => {
    const env = classifyEnvForChain(3, {
      LLM_CLASSIFY_CHAIN: "deepseek,qwen",
      DEEPSEEK_API_KEY: "sk",
    });
    expect(env.LLM_CLASSIFY_CHAIN).toBe("deepseek");
    expect(env.LLM_PROVIDER).toBe("deepseek");
  });

  it("fills hybrid classify chain default for chain 2 when unset", () => {
    const env = classifyEnvForChain(2, {});
    expect(env.LLM_CLASSIFY_CHAIN).toBe("deepseek,qwen");
  });
});
