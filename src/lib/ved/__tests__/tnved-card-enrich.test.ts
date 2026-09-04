import { describe, expect, it } from "vitest";
import { assembleTnvedCard } from "../tnved";
import {
  assembleCardEnrich,
  factsFromPack,
  normalizeEnrichFact,
  reconcileEnrichCodes,
  sanitizeEnrichText,
  TNVED_ENRICH_FIELD_KINDS,
  visibleCardEnrichFields,
} from "../tnved-card-enrich";

describe("tnved-card-enrich sanitize", () => {
  it("strips scripts, donor hosts, and HTML", () => {
    const dirty =
      '<script>alert(1)</script>Ставка 5% <a href="https://customsonline.ru/x">x</a> javascript:void(0) см. alta.ru';
    const clean = sanitizeEnrichText(dirty);
    expect(clean).not.toMatch(/script|customsonline|javascript:|alta\.ru|href/i);
    expect(clean).toMatch(/Ставка 5%/);
  });

  it("rejects unknown fieldKind and empty values", () => {
    expect(
      normalizeEnrichFact({
        code: "8471300000",
        fieldKind: "not_a_kind",
        valueShort: "1",
      }),
    ).toBeNull();
    expect(
      normalizeEnrichFact({
        code: "8471300000",
        fieldKind: "vat",
        valueShort: "",
        valueText: "",
      }),
    ).toBeNull();
  });
});

describe("tnved-card-enrich pack", () => {
  it("loads must-cover facts with VAT 22 for notebook code", () => {
    const { facts, sourceKey } = factsFromPack();
    expect(sourceKey).toContain("card-enrich");
    expect(facts.length).toBeGreaterThan(10);
    const vat = facts.find((f) => f.code === "8471300000" && f.fieldKind === "vat");
    expect(vat?.valueShort).toBe("22%");
    expect(vat?.valueText).toMatch(/22%/);
    expect(vat?.valueText).not.toMatch(/\b20%\b/);
    for (const f of facts) {
      expect(TNVED_ENRICH_FIELD_KINDS).toContain(f.fieldKind);
    }
  });

  it("assembles cardEnrich on TnvedCard from pack", () => {
    const card = assembleTnvedCard({
      row: {
        code: "8471300000",
        codeDisplay: "8471 30 000 0",
        titleRu: "машины вычислительные портативные",
        isLeaf: true,
        level: 10,
        rates: [],
      },
      ancestors: [],
    });
    expect(card.cardEnrich.schema).toBe("card-enrich/v1");
    expect(card.cardEnrich.fields.length).toBeGreaterThan(5);
    const vat = card.cardEnrich.fields.find((f) => f.fieldKind === "vat");
    expect(vat?.valueShort).toBe("22%");
  });

  it("visibleCardEnrichFields skips default VAT and measure duplicates", () => {
    const card = assembleTnvedCard({
      row: {
        code: "8471300000",
        codeDisplay: "8471 30 000 0",
        titleRu: "машины вычислительные портативные",
        isLeaf: true,
        level: 10,
        rates: [],
      },
      ancestors: [],
    });
    const visible = visibleCardEnrichFields(card.cardEnrich, {
      paymentsVatPct: 22,
      measures: card.measuresHint,
    });
    expect(visible.every((f) => f.fieldKind !== "vat")).toBe(true);
    expect(visible.every((f) => f.fieldKind !== "import_duty")).toBe(true);
    expect(visible.some((f) => f.fieldKind === "preliminary_classification")).toBe(true);
    expect(visible.some((f) => f.fieldKind === "preferential_good")).toBe(true);
  });

  it("reconcile reports missing codes", () => {
    const r = reconcileEnrichCodes(
      ["8471300000", "9999999999"],
      new Map([["8471300000", { isActive: true }]]),
    );
    expect(r.ok).toBe(1);
    expect(r.missingInTree).toEqual(["9999999999"]);
  });

  it("assembleCardEnrich fail-open empty", () => {
    const block = assembleCardEnrich({ code: "0101210000", facts: [] });
    expect(block.fields).toEqual([]);
  });
});
