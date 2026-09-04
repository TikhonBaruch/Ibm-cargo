import { describe, expect, it } from "vitest";
import { getClarificationQuestions } from "@/lbm-bro/lib/clarify-ai";
import {
  appendClarifyBlock,
  compositionFromClarify,
  hsHintFromClarify,
  progressiveClarifyQuestions,
  unansweredClarifyParts,
  wizardDraftForClarify,
} from "../new-calc-clarify";
import { hintTreeQuestions } from "@/lib/ved/tnved-hint-trees";

describe("new-calc clarify helper (C12)", () => {
  it("builds a single-item WizardDraft with empty docs", () => {
    const w = wizardDraftForClarify("носки", "Китай");
    expect(w.desc).toBe("носки");
    expect(w.country).toBe("Китай");
    expect(w.docs).toEqual([]);
    expect(w.packMode).toBe("single");
  });

  it("F4 progressive: composition hidden until tnved-form answered", async () => {
    const qs = await getClarificationQuestions({
      wizard: wizardDraftForClarify("очки", "Китай"),
      step: 1,
    });
    const packIds = hintTreeQuestions("очки").map((q) => q.id);
    expect(packIds).toEqual(["tnved-form", "composition"]);
    const before = progressiveClarifyQuestions(qs, {}, packIds);
    expect(before.map((q) => q.id)).toContain("tnved-form");
    expect(before.map((q) => q.id)).not.toContain("composition");
    const afterForm = progressiveClarifyQuestions(
      qs,
      { "tnved-form": "солнцезащитные очки" },
      packIds,
    );
    expect(afterForm.map((q) => q.id)).toEqual(
      expect.arrayContaining(["tnved-form", "composition"]),
    );
    // no pack → no filtering
    expect(progressiveClarifyQuestions(qs, {}, []).map((q) => q.id)).toEqual(qs.map((q) => q.id));
  });

  it("asks hosiery pack chips for «носки» (F5)", async () => {
    const qs = await getClarificationQuestions({
      wizard: wizardDraftForClarify("носки", "Китай"),
      step: 1,
    });
    expect(qs.map((q) => q.id)).toEqual(expect.arrayContaining(["tnved-form", "composition"]));
    expect(qs.find((q) => q.id === "tnved-form")?.text).toMatch(/чулочно-носочн/i);
    expect(qs.find((q) => q.id === "tnved-form")?.options?.some((o) => o.id === "socks")).toBe(true);
    // category knit/color skipped via skipQuestionIds
    expect(qs.map((q) => q.id)).not.toContain("knit-woven");
    expect(qs.map((q) => q.id)).not.toContain("color");
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

  it("P2: огурец fork — свежий 0707 / рассол 0711 / маринад·консервы 2001", async () => {
    const qs = await getClarificationQuestions({
      wizard: wizardDraftForClarify("огурец", "Китай"),
      step: 1,
    });
    expect(qs[0]?.id).toBe("tnved-form");
    expect(qs[0]?.text).toMatch(/овощ/i);
    expect(qs.map((q) => q.id)).not.toContain("kind");

    const fresh = qs[0]?.options?.find((o) => o.id === "fresh");
    const preserved = qs[0]?.options?.find((o) => o.id === "preserved");
    const prepared = qs[0]?.options?.find((o) => o.id === "prepared");
    expect(fresh?.hsHeading).toBe("0707");
    expect(preserved?.hsHeading).toBe("0711");
    expect(prepared?.hsHeading).toBe("2001");

    expect(hsHintFromClarify(qs, { "tnved-form": fresh!.value })).toBe("0707");
    expect(hsHintFromClarify(qs, { "tnved-form": preserved!.value })).toBe("0711");
    expect(hsHintFromClarify(qs, { "tnved-form": prepared!.value })).toBe("2001");

    for (const opt of [fresh!, preserved!, prepared!]) {
      const digits = (opt.hsHeading || "").replace(/\D/g, "");
      expect(digits.startsWith("61") || digits.startsWith("04") || digits.startsWith("65")).toBe(
        false,
      );
    }

    const applied = appendClarifyBlock(
      "огурец",
      unansweredClarifyParts(qs, { "tnved-form": prepared!.value }, []),
    );
    expect(applied).toMatch(/овощи готовые консервы/i);
    expect(applied).toContain("Овощи: в каком виде?");
    expect(applied).not.toMatch(/футболка|майка|йогурт/i);
  });

  it("P2: маринованные огурцы / корнишоны still open produce fork (not knit-top)", async () => {
    for (const desc of ["маринованные огурцы", "корнишоны"] as const) {
      const qs = await getClarificationQuestions({
        wizard: wizardDraftForClarify(desc, "Китай"),
        step: 1,
      });
      expect(qs[0]?.id, desc).toBe("tnved-form");
      const prepared = qs[0]?.options?.find((o) => o.id === "prepared");
      expect(prepared, desc).toBeTruthy();
      expect(hsHintFromClarify(qs, { "tnved-form": prepared!.value }), desc).toBe("2001");
      expect(
        qs[0]?.options?.some((o) => (o.hsHeading || "").startsWith("61")),
        desc,
      ).toBe(false);
    }
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
