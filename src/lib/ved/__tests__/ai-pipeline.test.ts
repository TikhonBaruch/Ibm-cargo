import { describe, expect, it, vi, afterEach } from "vitest";
import {
  mediaUrlMeta,
  shouldEnqueueAiDrain,
  runAiDrainPipeline,
} from "../ai-pipeline";

describe("shouldEnqueueAiDrain", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when llm enrich is off", () => {
    vi.stubEnv("LLM_SERVICE_URL", "http://llm:4500");
    expect(shouldEnqueueAiDrain({ llmEnrichEnabled: false })).toBe(false);
  });

  it("is false when no OCR/LLM URL and no provider keys", () => {
    vi.stubEnv("OCR_SERVICE_URL", "");
    vi.stubEnv("LLM_SERVICE_URL", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("QWEN_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("LLM_PROVIDER", "");
    expect(shouldEnqueueAiDrain({ llmEnrichEnabled: true })).toBe(false);
  });

  it("is true when LLM URL is set", () => {
    vi.stubEnv("LLM_SERVICE_URL", "http://llm:4500");
    vi.stubEnv("OCR_SERVICE_URL", "");
    expect(shouldEnqueueAiDrain({ llmEnrichEnabled: true })).toBe(true);
  });

  it("is true when DeepSeek key is set without service URL (Vercel)", () => {
    vi.stubEnv("LLM_SERVICE_URL", "");
    vi.stubEnv("OCR_SERVICE_URL", "");
    vi.stubEnv("LLM_PROVIDER", "deepseek");
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    expect(shouldEnqueueAiDrain({ llmEnrichEnabled: true })).toBe(true);
  });
});
describe("mediaUrlMeta", () => {
  it("omits raw url and hashes it", () => {
    const meta = mediaUrlMeta("https://files.example/uploads/ved/photo.jpg");
    expect(meta.present).toBe(true);
    expect(JSON.stringify(meta)).not.toContain("https://files.example");
    expect(meta.sha256).toHaveLength(16);
  });

  it("marks missing url", () => {
    expect(mediaUrlMeta(null)).toEqual({ present: false });
  });
});

describe("runAiDrainPipeline", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("skips when no service URLs and no provider keys", async () => {
    vi.stubEnv("OCR_SERVICE_URL", "");
    vi.stubEnv("LLM_SERVICE_URL", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("QWEN_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("LLM_PROVIDER", "");
    const db = { calculation: { findUnique: vi.fn() } };
    const out = await runAiDrainPipeline(db as never, { calculationId: "c1" });
    expect(out.skipped).toBe(true);
    expect(out.ok).toBe(true);
    expect(db.calculation.findUnique).not.toHaveBeenCalled();
  });

  it("describes then resets then classifies; reset failure does not roll back HS", async () => {
    vi.stubEnv("OCR_SERVICE_URL", "http://ocr:4700");
    vi.stubEnv("LLM_SERVICE_URL", "http://llm:4500");
    vi.stubEnv("MEDIA_URL_ALLOWED_PREFIXES", "https://x");
    const calls: Array<{ id: string; op: string }> = [];
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith("/v1/describe")) {
        return new Response(
          JSON.stringify({ engine: "qwen-vl-v1", description: "белая майка хлопок" }),
          { status: 200 }
        );
      }
      if (String(url).endsWith("/v1/reset")) {
        return new Response(JSON.stringify({ error: "reset timeout" }), { status: 504 });
      }
      if (String(url).endsWith("/v1/classify")) {
        return new Response(
          JSON.stringify({ hsCode: "6109 10 000 0", engine: "llm-openai-v1" }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const db = {
      calculation: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          title: "Партия",
          description: "одежда",
          country: "CN",
          items: [{ id: "i1", name: "майка", mediaUrl: "https://x/a.jpg", sortOrder: 0, attrs: {} }],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      calculationItem: { update: vi.fn().mockResolvedValue({}) },
      serviceCall: {
        create: vi.fn(async ({ data }: { data: { operation: string } }) => {
          const id = `sc-${data.operation}`;
          calls.push({ id, op: data.operation });
          return { id };
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const out = await runAiDrainPipeline(db as never, { calculationId: "c1" });

    expect(out.ok).toBe(true);
    expect(out.hsCode).toBe("6109 10 000 0");
    expect(out.visionDescription).toMatch(/майка/);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.endsWith("/v1/describe"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/v1/reset"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/v1/classify"))).toBe(true);
    const describeIdx = urls.findIndex((u) => u.endsWith("/v1/describe"));
    const resetIdx = urls.findIndex((u) => u.endsWith("/v1/reset"));
    expect(resetIdx).toBeGreaterThan(describeIdx);
    expect(calls.map((c) => c.op)).toEqual(expect.arrayContaining(["describe", "reset", "classify"]));
  });

  it("waits for vision before classify when media present and describe fails", async () => {
    vi.stubEnv("OCR_SERVICE_URL", "http://ocr:4700");
    vi.stubEnv("LLM_SERVICE_URL", "http://llm:4500");
    vi.stubEnv("MEDIA_URL_ALLOWED_PREFIXES", "https://x");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith("/v1/describe")) {
        return new Response(JSON.stringify({ error: "timeout" }), { status: 504 });
      }
      if (String(url).endsWith("/v1/reset")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (String(url).endsWith("/v1/classify")) {
        return new Response(JSON.stringify({ hsCode: "0812 90 700 0" }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const db = {
      calculation: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          title: "манго",
          description: "",
          country: "CN",
          items: [{ id: "i1", name: "манго", mediaUrl: "https://x/mango.jpg", sortOrder: 0, attrs: {} }],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      calculationItem: { update: vi.fn().mockResolvedValue({}) },
      serviceCall: {
        create: vi.fn(async () => ({ id: "sc" })),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const out = await runAiDrainPipeline(db as never, { calculationId: "c1", attempt: 1 });
    expect(out.ok).toBe(false);
    expect(out.retriable).toBe(true);
    expect(out.error).toMatch(/vision|describe|timeout/i);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.endsWith("/v1/classify"))).toBe(false);
  });

  it("allows classify without vision on last AI_DRAIN attempt", async () => {
    vi.stubEnv("OCR_SERVICE_URL", "http://ocr:4700");
    vi.stubEnv("LLM_SERVICE_URL", "http://llm:4500");
    vi.stubEnv("MEDIA_URL_ALLOWED_PREFIXES", "https://x");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith("/v1/describe")) {
        return new Response(JSON.stringify({ error: "timeout" }), { status: 504 });
      }
      if (String(url).endsWith("/v1/reset")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (String(url).endsWith("/v1/classify")) {
        return new Response(
          JSON.stringify({ hsCode: "0804 50 000 9", engine: "llm-openai-v1" }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const db = {
      calculation: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          title: "манго",
          description: "",
          country: "CN",
          confidence: 0.5,
          aiDraft: {},
          items: [{ id: "i1", name: "манго", mediaUrl: "https://x/mango.jpg", sortOrder: 0, attrs: {} }],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      calculationItem: { update: vi.fn().mockResolvedValue({}) },
      serviceCall: {
        create: vi.fn(async () => ({ id: "sc" })),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const out = await runAiDrainPipeline(db as never, { calculationId: "c1", attempt: 6 });
    expect(out.ok).toBe(true);
    expect(out.hsCode).toBe("0804 50 000 9");
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/v1/classify"))).toBe(true);
  });

  it("skips classify when aiDraft offline hit is confident (C35a)", async () => {
    vi.stubEnv("OCR_SERVICE_URL", "");
    vi.stubEnv("LLM_SERVICE_URL", "http://llm:4500");
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith("/v1/classify")) {
        return new Response(JSON.stringify({ hsCode: "9999 99 999 9" }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const db = {
      calculation: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          title: "огурцы",
          description: "",
          country: "CN",
          confidence: 0.9,
          hsCode: "0707 00 900 1",
          aiDraft: {
            hsCode: "0707 00 900 1",
            confidence: 0.9,
            engine: "cascade-v1",
            llmEnrichPending: true,
          },
          items: [{ id: "i1", name: "огурцы", mediaUrl: null, sortOrder: 0, attrs: {} }],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      calculationItem: { update: vi.fn().mockResolvedValue({}) },
      serviceCall: {
        create: vi.fn(async () => ({ id: "sc" })),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const out = await runAiDrainPipeline(db as never, { calculationId: "c1" });
    expect(out.ok).toBe(true);
    expect(out.skipped).toBe(true);
    expect(out.engine).toBe("cascade-v1");
    expect(out.hsCode).toBe("0707 00 900 1");
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/v1/classify"))).toBe(false);
    const updateArg = db.calculation.update.mock.calls.find(
      (c) => c[0]?.data?.aiDraft?.skipReason
    );
    expect(updateArg?.[0]?.data?.aiDraft?.skipReason).toBe("offline-hit:cascade-v1");
  });
});
