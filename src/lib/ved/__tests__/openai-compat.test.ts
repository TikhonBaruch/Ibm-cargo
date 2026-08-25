import { describe, expect, it, afterEach, vi } from "vitest";
import {
  providerClassifyConfigured,
  qwenVisionConfigured,
  resolveClassifyChain,
  resolveOpenAiCompat,
} from "../openai-compat";
import {
  AI_DRAIN_MAX_ATTEMPTS,
  aiDrainAllowClassifyWithoutVision,
  aiDrainRetryDelayMs,
  aiDrainShouldRequeue,
  logAiDrain,
  visionDescribeTimeoutMs,
} from "../ai-drain-retry";

describe("openai-compat", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves deepseek profile", () => {
    vi.stubEnv("LLM_PROVIDER", "deepseek");
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-ds");
    const c = resolveOpenAiCompat(process.env);
    expect(c.profile).toBe("deepseek");
    expect(c.key).toBe("sk-ds");
    expect(c.base).toContain("deepseek");
    expect(providerClassifyConfigured(process.env)).toBe(true);
  });

  it("detects qwen vision key", () => {
    vi.stubEnv("QWEN_API_KEY", "");
    expect(qwenVisionConfigured(process.env)).toBe(false);
    vi.stubEnv("QWEN_API_KEY", "sk-qw");
    expect(qwenVisionConfigured(process.env)).toBe(true);
  });

  it("builds classify chain deepseek then qwen when both keys set", () => {
    vi.stubEnv("LLM_CLASSIFY_CHAIN", "deepseek,qwen");
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-ds");
    vi.stubEnv("QWEN_API_KEY", "sk-qw");
    const chain = resolveClassifyChain(process.env);
    expect(chain.map((c) => c.profile)).toEqual(["deepseek", "qwen"]);
  });

  it("skips providers without keys in chain", () => {
    vi.stubEnv("LLM_CLASSIFY_CHAIN", "deepseek,qwen");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("QWEN_API_KEY", "sk-qw");
    const chain = resolveClassifyChain(process.env);
    expect(chain.map((c) => c.profile)).toEqual(["qwen"]);
  });
});

describe("ai-drain-retry schedule", () => {
  it("uses staggered delays 30s → 2m → 5m → 15m", () => {
    expect(aiDrainRetryDelayMs(1)).toBe(30_000);
    expect(aiDrainRetryDelayMs(2)).toBe(120_000);
    expect(aiDrainRetryDelayMs(3)).toBe(300_000);
    expect(aiDrainRetryDelayMs(4)).toBe(900_000);
    expect(aiDrainRetryDelayMs(5)).toBe(900_000);
  });

  it("requeues while attempts < max and retriable", () => {
    expect(aiDrainShouldRequeue({ retriable: true, attempts: 1 })).toBe(true);
    expect(aiDrainShouldRequeue({ retriable: true, attempts: AI_DRAIN_MAX_ATTEMPTS })).toBe(false);
    expect(aiDrainShouldRequeue({ retriable: false, attempts: 1 })).toBe(false);
  });

  it("vision describe timeout defaults to 90s", () => {
    expect(visionDescribeTimeoutMs({})).toBe(90_000);
    expect(visionDescribeTimeoutMs({ OCR_TIMEOUT_MS: "120000" } as NodeJS.ProcessEnv)).toBe(120_000);
  });

  it("allows classify without vision only on last attempt", () => {
    expect(aiDrainAllowClassifyWithoutVision({ attempt: 1 })).toBe(false);
    expect(aiDrainAllowClassifyWithoutVision({ attempt: 5 })).toBe(false);
    expect(aiDrainAllowClassifyWithoutVision({ attempt: 6 })).toBe(true);
  });

  it("logAiDrain writes structured JSON without throwing", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logAiDrain({
      phase: "test",
      calculationId: "c1",
      attempt: 1,
      provider: "deepseek",
      ok: false,
      retriable: true,
      delayMs: 30_000,
    });
    expect(spy).toHaveBeenCalled();
    const payload = String(spy.mock.calls[0]?.[1] || "");
    expect(payload).toContain('"scope":"ai-drain"');
    expect(payload).toContain('"phase":"test"');
    expect(payload).not.toContain("sk-");
    spy.mockRestore();
  });
});
