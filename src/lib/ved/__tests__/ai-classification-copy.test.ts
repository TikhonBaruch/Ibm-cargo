import { describe, expect, it } from "vitest";
import {
  AI_CLASSIFY_LOW_CONF,
  calcConfidencePct,
  classificationDisclaimer,
  classificationHeroKicker,
  classificationWhyBody,
  classificationWhyTitle,
  needsClassificationClarify,
  shouldRevealClientDraftHs,
} from "../ai-classification-copy";

describe("C22 ai classification copy", () => {
  it("strips test-mode sentence from disclaimer", () => {
    const calc = {
      aiDraft: {
        disclaimer:
          "Товар — молоко. Тестовый режим: ключ не задан. Использован запасной путь; heuristic-v1.",
      },
    };
    expect(classificationDisclaimer(calc)).toBe("Товар — молоко.");
  });

  it("warns when confidence is below threshold", () => {
    const low = { hsCode: "0401", confidence: AI_CLASSIFY_LOW_CONF - 0.05 };
    const ok = { hsCode: "0401", confidence: 0.82 };
    expect(needsClassificationClarify(low)).toBe(true);
    expect(classificationWhyTitle(low)).toBe("Нужно уточнение");
    expect(needsClassificationClarify(ok)).toBe(false);
    expect(classificationWhyTitle(ok)).toBe("Почему этот код");
  });

  it("maps confidence ratio to percent", () => {
    expect(calcConfidencePct({ confidence: 0.78 })).toBe(78);
    expect(calcConfidencePct({ aiDraft: { confidence: 0.55 } })).toBe(55);
    expect(calcConfidencePct({})).toBeNull();
  });

  it("uses disclaimer as why body when present", () => {
    const calc = {
      hsCode: "040210",
      confidence: 0.7,
      aiDraft: { disclaimer: "Сухое молоко — глава 04." },
    };
    expect(classificationWhyBody(calc)).toBe("Сухое молоко — глава 04.");
  });

  it("kicker reflects pending preliminary code", () => {
    const calc = { hsCode: "0401" };
    expect(classificationHeroKicker(calc, true)).toBe("Предварительный код ТН ВЭД");
    expect(classificationHeroKicker(calc, false)).toBe("Код ТН ВЭД ЕАЭС");
    expect(classificationHeroKicker({}, true)).toBe("AI подбирает код");
  });

  it("hides draft HS until tariff paid", () => {
    const locked = {
      status: "AI_READY",
      hsCode: "8471300000",
      confidence: 0.82,
    };
    const unlocked = { ...locked, paidAt: "2026-01-01T00:00:00.000Z" };
    expect(shouldRevealClientDraftHs(locked)).toBe(false);
    expect(shouldRevealClientDraftHs(unlocked)).toBe(true);
  });
});
