import { describe, expect, it } from "vitest";
import {
  LLM_SOFT_FAIL,
  appendLlmSoftFails,
  formatTestModeLlmNotice,
  softFailCodeForClassifyProfile,
} from "../ai-drain-retry";
import { buildPdfHtml } from "../domain";

describe("test-mode LLM soft-fail notice", () => {
  it("formats client labels without raw errors", () => {
    const notice = formatTestModeLlmNotice([
      LLM_SOFT_FAIL.VISION_QWEN,
      LLM_SOFT_FAIL.CLASSIFY_DEEPSEEK,
    ]);
    expect(notice).toMatch(/Тестовый режим/);
    expect(notice).toMatch(/распознавание фото \(Qwen\)/);
    expect(notice).toMatch(/классификация DeepSeek/);
    expect(notice).not.toMatch(/401|API key|sk-/i);
  });

  it("maps classify profiles to soft-fail codes", () => {
    expect(softFailCodeForClassifyProfile("deepseek")).toBe(LLM_SOFT_FAIL.CLASSIFY_DEEPSEEK);
    expect(softFailCodeForClassifyProfile("qwen")).toBe(LLM_SOFT_FAIL.CLASSIFY_QWEN);
  });

  it("appendLlmSoftFails merges into disclaimer and dedupes", () => {
    let draft = appendLlmSoftFails(
      { disclaimer: "Рекомендация AI." },
      [LLM_SOFT_FAIL.VISION_QWEN]
    );
    draft = appendLlmSoftFails(draft, [LLM_SOFT_FAIL.VISION_QWEN, LLM_SOFT_FAIL.CLASSIFY_CHAIN]);
    expect(draft.llmSoftFails).toEqual([
      LLM_SOFT_FAIL.VISION_QWEN,
      LLM_SOFT_FAIL.CLASSIFY_CHAIN,
    ]);
    const d = String(draft.disclaimer);
    expect(d.match(/Тестовый режим:/g)?.length).toBe(1);
    expect(d).toMatch(/Рекомендация AI/);
  });

  it("PDF disclaimer carries test-mode notice", () => {
    const draft = appendLlmSoftFails({}, [LLM_SOFT_FAIL.VISION_QWEN]);
    const html = buildPdfHtml({
      number: "#1",
      title: "Чашка",
      hsCode: "6911 10 000 0",
      disclaimer: String(draft.disclaimer),
    });
    expect(html).toMatch(/Тестовый режим/);
    expect(html).toMatch(/распознавание фото/);
  });
});
