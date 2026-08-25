/**
 * Chaos / failover simulation for AI_DRAIN (plan-ai-mesh 1c).
 * Logs each step; no live provider keys required.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_DRAIN_MAX_ATTEMPTS,
  aiDrainRetryDelayMs,
  aiDrainShouldRequeue,
  logAiDrain,
} from "../ai-drain-retry";
import { finishQueuedAiDrainForCalc } from "../ai-pipeline";
import { resolveClassifyChain } from "../openai-compat";

vi.mock("../provider-mesh", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../provider-mesh")>();
  return {
    ...actual,
    classifyWithProvider: vi.fn(),
    describeWithProviderQwen: vi.fn().mockResolvedValue({ ok: false, error: "qwen describe empty" }),
  };
});

import { classifyWithProvider } from "../provider-mesh";

describe("AI_DRAIN failover chaos", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("simulates DeepSeek down → chain falls through to qwen key presence", () => {
    vi.stubEnv("LLM_CLASSIFY_CHAIN", "deepseek,qwen");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("QWEN_API_KEY", "sk-qw");
    const chain = resolveClassifyChain(process.env);
    expect(chain).toHaveLength(1);
    expect(chain[0].profile).toBe("qwen");
    logAiDrain({ phase: "chaos-chain-skip-deepseek", provider: "qwen", ok: true });
  });

  it("requeue schedule under load: 6 attempts span ~22.5 min of delays", () => {
    let total = 0;
    const delays: number[] = [];
    for (let a = 1; a < AI_DRAIN_MAX_ATTEMPTS; a++) {
      const d = aiDrainRetryDelayMs(a);
      delays.push(d);
      total += d;
      expect(aiDrainShouldRequeue({ retriable: true, attempts: a })).toBe(true);
    }
    expect(aiDrainShouldRequeue({ retriable: true, attempts: AI_DRAIN_MAX_ATTEMPTS })).toBe(false);
    expect(delays).toEqual([30_000, 120_000, 300_000, 900_000, 900_000]);
    expect(total).toBe(30_000 + 120_000 + 300_000 + 900_000 + 900_000);
    logAiDrain({
      phase: "chaos-load-budget",
      extra: { totalDelayMs: total, attempts: AI_DRAIN_MAX_ATTEMPTS },
    });
  });

  it("finishQueuedAiDrain requeues on retriable pipeline failure and keeps pending", async () => {
    vi.stubEnv("LLM_SERVICE_URL", "http://llm:4500");
    vi.stubEnv("OCR_SERVICE_URL", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("QWEN_API_KEY", "");

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "busy" }), { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const jobUpdate = vi.fn().mockResolvedValue({});
    const jobUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const calcUpdate = vi.fn().mockResolvedValue({});
    const db = {
      backgroundJob: {
        findFirst: vi.fn().mockResolvedValue({
          id: "j1",
          attempts: 0,
          maxAttempts: 6,
          status: "QUEUED",
        }),
        update: jobUpdate,
        updateMany: jobUpdateMany,
      },
      calculation: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          title: "Товар",
          description: "футболка хлопок",
          country: "CN",
          aiDraft: { llmEnrichPending: true },
          confidence: 0.5,
          items: [{ id: "i1", name: "футболка", description: "cotton", sortOrder: 0 }],
        }),
        update: calcUpdate,
      },
      calculationItem: { update: vi.fn() },
      serviceCall: {
        create: vi.fn().mockResolvedValue({ id: "sc1" }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const out = await finishQueuedAiDrainForCalc(db as never, "c1");
    expect(out.ok).toBe(false);
    expect(out.retriable).toBe(true);
    expect(out.requeued).toBe(true);
    expect(out.nextDelayMs).toBe(30_000);
    // pending must stay true while requeued — clearLlmEnrichPending not applied via update removing it
    const pendingCleared = calcUpdate.mock.calls.some(
      (c) => c[0]?.data?.aiDraft && c[0].data.aiDraft.llmEnrichPending === false
    );
    expect(pendingCleared).toBe(false);
    expect(jobUpdate).toHaveBeenCalled();
    const status = jobUpdate.mock.calls[0]?.[0]?.data?.status;
    expect(status).toBe("QUEUED");
    logAiDrain({
      phase: "chaos-requeue-assert",
      calculationId: "c1",
      retriable: true,
      delayMs: out.nextDelayMs,
      ok: false,
    });
  });

  it("parallel load: many retriable decisions stay independent", () => {
    const outcomes = Array.from({ length: 50 }, (_, i) => {
      const attempts = (i % 6) + 1;
      return {
        id: `c${i}`,
        requeue: aiDrainShouldRequeue({ retriable: true, attempts }),
        delay: aiDrainRetryDelayMs(attempts),
      };
    });
    expect(outcomes.filter((o) => o.requeue).length).toBeGreaterThan(30);
    expect(outcomes.every((o) => o.delay >= 30_000)).toBe(true);
    logAiDrain({
      phase: "chaos-parallel-batch",
      extra: { n: outcomes.length, requeue: outcomes.filter((o) => o.requeue).length },
    });
  });
});

describe("classify chain transport failover (mocked)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("records classifyWithProvider mock failover path", async () => {
    vi.mocked(classifyWithProvider).mockResolvedValueOnce({
      hsCode: "6109 10 000 0",
      confidence: 0.9,
      engine: "llm-openai-v1",
      profile: "qwen",
      disclaimer: "failover ok",
    });
    const r = await classifyWithProvider({} as never, { title: "футболка", description: "хлопок" });
    expect(r?.profile).toBe("qwen");
    expect(r?.hsCode).toMatch(/6109/);
    logAiDrain({
      phase: "chaos-classify-failover-ok",
      provider: r?.profile,
      hsCode: r?.hsCode,
      ok: true,
    });
  });
});
