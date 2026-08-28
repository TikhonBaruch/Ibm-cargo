import { describe, expect, it } from "vitest";
import { getClarificationQuestions } from "@/lbm-bro/lib/clarify-ai";
import {
  appendClarifyBlock,
  compositionFromClarify,
  hsHintFromClarify,
  unansweredClarifyParts,
  wizardDraftForClarify,
} from "../new-calc-clarify";

describe("new-calc clarify helper (C12)", () => {
  it("builds a single-item WizardDraft with empty docs", () => {
    const w = wizardDraftForClarify("носки", "Китай");
    expect(w.desc).toBe("носки");
    expect(w.country).toBe("Китай");
    expect(w.docs).toEqual([]);
    expect(w.packMode).toBe("single");
  });

  it("asks apparel chips for «носки» (composition / knit / color)", async () => {
    const qs = await getClarificationQuestions({
      wizard: wizardDraftForClarify("носки", "Китай"),
      step: 1,
    });
    expect(qs.map((q) => q.id)).toEqual(["composition", "knit-woven", "color"]);
    expect(qs[0].text).toMatch(/состав ткани/);
    expect(qs[1].text).toMatch(/трикотаж/i);
    expect(qs[2].text).toMatch(/цвет/i);
    expect(qs[0].options?.some((o) => o.label === "100% хлопок")).toBe(true);
    expect(qs[0].options?.some((o) => o.label === "Другое")).toBe(true);
  });

  it("does not ask when description is empty", async () => {
    const qs = await getClarificationQuestions({
      wizard: wizardDraftForClarify("   ", "Китай"),
      step: 1,
    });
    expect(qs).toEqual([]);
  });

  it("appends Уточнения (ИИ) and prefers composition chip", () => {
    const parts = unansweredClarifyParts(
      [
        { id: "composition", text: "Какой состав ткани?", required: false },
        { id: "color", text: "Какой основной цвет?", required: false },
      ],
      { composition: "100% хлопок", color: "чёрный" },
      [],
    );
    expect(parts).toHaveLength(2);
    const next = appendClarifyBlock("носки", parts);
    expect(next).toContain("Уточнения (ИИ):");
    expect(next).toContain("Ответ: 100% хлопок");
    expect(next).toContain("Ответ: чёрный");
    expect(compositionFromClarify({ composition: "100% хлопок" }, "носки")).toBe("100% хлопок");
    expect(compositionFromClarify({}, "носки")).toBe("носки");
  });

  it("asks milk form chips and maps dry milk to heading 040210", async () => {
    const qs = await getClarificationQuestions({
      wizard: wizardDraftForClarify("молоко", "Китай"),
      step: 1,
    });
    expect(qs[0]?.id).toBe("tnved-form");
    expect(qs[0]?.text).toMatch(/молоко/i);
    const labels = (qs[0]?.options || []).map((o) => o.label).join(" ");
    expect(labels).toMatch(/Питьевое/);
    expect(labels).toMatch(/Сухое/);
    expect(labels).toMatch(/Сгущённое/);
    expect(qs.map((q) => q.id)).not.toContain("kind");
    const dry = qs[0]?.options?.find((o) => o.label.includes("Сухое"));
    expect(dry?.hsHeading).toBe("040210");
    expect(
      hsHintFromClarify(qs, { "tnved-form": dry?.value || "" }),
    ).toBe("040210");
    expect(
      hsHintFromClarify(qs, {
        "tnved-form": qs[0]?.options?.find((o) => o.id === "fresh")?.value || "",
      }),
    ).toBe("0401");
  });

  it("skips already-applied ids and empty answers", () => {
    const parts = unansweredClarifyParts(
      [
        { id: "composition", text: "Какой состав ткани?", required: false },
        { id: "color", text: "Какой основной цвет?", required: false },
      ],
      { composition: "100% хлопок", color: "" },
      ["composition"],
    );
    expect(parts).toEqual([]);
    expect(appendClarifyBlock("носки", parts)).toBe("носки");
  });
});
