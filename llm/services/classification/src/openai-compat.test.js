import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveOpenAiCompat } from "./openai-compat.js";

describe("resolveOpenAiCompat", () => {
  it("uses DeepSeek defaults when LLM_PROVIDER=deepseek", () => {
    const r = resolveOpenAiCompat({
      LLM_PROVIDER: "deepseek",
      DEEPSEEK_API_KEY: "sk-test",
      OPENAI_API_KEY: "nvapi-keep",
      LLM_CLASSIFY_MODEL: "meta/llama-3.1-8b-instruct",
    });
    assert.equal(r.profile, "deepseek");
    assert.equal(r.key, "sk-test");
    assert.equal(r.base, "https://api.deepseek.com/v1");
    assert.equal(r.classifyModel, "deepseek-chat");
  });

  it("uses DashScope compatible-mode when LLM_PROVIDER=qwen", () => {
    const r = resolveOpenAiCompat({
      LLM_PROVIDER: "qwen",
      QWEN_API_KEY: "sk-qwen",
    });
    assert.equal(r.profile, "qwen");
    assert.equal(r.key, "sk-qwen");
    assert.equal(r.base, "https://dashscope.aliyuncs.com/compatible-mode/v1");
    assert.equal(r.classifyModel, "qwen-plus");
  });

  it("keeps NVIDIA OPENAI_* when LLM_PROVIDER unset", () => {
    const r = resolveOpenAiCompat({
      OPENAI_API_KEY: "nvapi-keep",
      OPENAI_BASE_URL: "https://integrate.api.nvidia.com/v1",
      LLM_CLASSIFY_MODEL: "meta/llama-3.1-8b-instruct",
    });
    assert.equal(r.profile, "nvidia");
    assert.equal(r.key, "nvapi-keep");
    assert.equal(r.classifyModel, "meta/llama-3.1-8b-instruct");
  });
});
