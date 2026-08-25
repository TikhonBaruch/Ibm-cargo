import { describe, expect, it, afterEach, vi } from "vitest";
import {
  classifyTransport,
  visionConfiguredForChain,
  visionModeForChain,
  visionPhasesForChain,
  visionSoftFailForChain,
  visionTransport,
} from "../chains";

describe("runChain facade", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps chain 3 to deepseek vision mode and soft-fail (mesh)", () => {
    vi.stubEnv("OCR_SERVICE_URL", "");
    expect(visionModeForChain(3)).toBe("direct-deepseek");
    expect(visionSoftFailForChain(3)).toBe("vision-deepseek");
    expect(visionPhasesForChain(3)).toEqual({
      fail: "vision-deepseek-fail",
      ok: "vision-deepseek-ok",
    });
  });

  it("maps chain 2 to qwen vision (mesh)", () => {
    vi.stubEnv("OCR_SERVICE_URL", "");
    expect(visionModeForChain(2)).toBe("direct-qwen");
    expect(visionSoftFailForChain(2)).toBe("vision-qwen");
  });

  it("visionConfiguredForChain respects keys on mesh", () => {
    vi.stubEnv("OCR_SERVICE_URL", "");
    expect(visionConfiguredForChain(3, {})).toBe(false);
    expect(visionConfiguredForChain(3, { DEEPSEEK_API_KEY: "sk" })).toBe(true);
    expect(visionConfiguredForChain(2, { QWEN_API_KEY: "sk" })).toBe(true);
    expect(visionConfiguredForChain(2, { DEEPSEEK_API_KEY: "sk" })).toBe(false);
  });

  it("OCR_SERVICE_URL forces service transport for vision", () => {
    vi.stubEnv("OCR_SERVICE_URL", "http://ocr:4700");
    vi.stubEnv("LLM_SERVICE_URL", "");
    expect(visionTransport()).toBe("service");
    expect(visionModeForChain(3)).toBe("ocr-service");
    expect(visionConfiguredForChain(3, { OCR_SERVICE_URL: "http://ocr:4700" })).toBe(true);
    expect(classifyTransport()).toBe("mesh");
  });

  it("LLM_SERVICE_URL forces service transport for classify", () => {
    vi.stubEnv("OCR_SERVICE_URL", "");
    vi.stubEnv("LLM_SERVICE_URL", "http://llm:4500");
    expect(classifyTransport()).toBe("service");
    expect(visionTransport()).toBe("mesh");
  });
});
