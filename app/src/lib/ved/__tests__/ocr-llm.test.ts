import { describe, expect, it, vi, afterEach } from "vitest";
import { extractWithOcr, mergeAttrs } from "@/lib/ved/ocr";
import { enrichDraftWithLlm } from "@/lib/ved/llm-enrich";
import type { AiDraftResult } from "@/lib/ved/domain";

const baseDraft: AiDraftResult = {
  hsCode: "8471 30 000 0",
  duties: { customsDutyPercent: 0, vatPercent: 22, feeRub: 100 },
  documents: [],
  confidence: 0.7,
  disclaimer: "heuristic",
};

describe("ocr fail-open", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns null when OCR_SERVICE_URL unset", async () => {
    vi.stubEnv("OCR_SERVICE_URL", "");
    await expect(
      extractWithOcr({ mediaUrl: "https://example.com/a.pdf", hint: "ноутбук" })
    ).resolves.toBeNull();
  });

  it("merges attrs with client winning", () => {
    expect(mergeAttrs({ brand: "Client" }, { brand: "Ocr", model: "X" })).toEqual({
      brand: "Client",
      model: "X",
    });
  });

  it("returns attrs when OCR stub responds", async () => {
    vi.stubEnv("OCR_SERVICE_URL", "http://ocr:4700");
    vi.stubEnv("MEDIA_URL_ALLOWED_PREFIXES", "https://example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          engine: "ocr-stub-v0",
          attrs: { purpose: "ноутбук", brand: "OCR" },
          confidence: 0.35,
        }),
      })
    );
    const out = await extractWithOcr({
      mediaUrl: "https://example.com/inv.pdf",
      hint: "ноутбук",
    });
    expect(out?.engine).toBe("ocr-stub-v0");
    expect(out?.attrs).toEqual({ purpose: "ноутбук", brand: "OCR" });
  });

  it("returns null when mediaUrl is not allowlisted", async () => {
    vi.stubEnv("OCR_SERVICE_URL", "http://ocr:4700");
    vi.stubEnv("MEDIA_URL_ALLOWED_PREFIXES", "");
    vi.stubEnv("S3_ENDPOINT", "");
    vi.stubEnv("S3_BUCKET", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      extractWithOcr({ mediaUrl: "https://169.254.169.254/latest/meta-data" })
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null on fetch failure", async () => {
    vi.stubEnv("OCR_SERVICE_URL", "http://ocr:4700");
    vi.stubEnv("MEDIA_URL_ALLOWED_PREFIXES", "https://example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("down"))
    );
    await expect(
      extractWithOcr({ mediaUrl: "https://example.com/a.pdf" })
    ).resolves.toBeNull();
  });
});

describe("llm-enrich fail-open (Next path)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns draft when LLM_SERVICE_URL unset and no provider keys", async () => {
    vi.stubEnv("LLM_SERVICE_URL", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("QWEN_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("LLM_PROVIDER", "");
    const out = await enrichDraftWithLlm({ description: "ноутбук" }, baseDraft);
    expect(out.hsCode).toBe(baseDraft.hsCode);
    expect(out.llmEnrich).toBeUndefined();
  });
});
