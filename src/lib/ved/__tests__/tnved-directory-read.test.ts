import { describe, expect, it } from "vitest";
import { assembleTnvedCard } from "../tnved";
import {
  directoryPrefillFromQuery,
  directoryReadFromCard,
  directoryWizardHref,
  formatDirectoryDuty,
} from "../tnved-directory-read";

describe("directory duty label", () => {
  it("prints ad valorem percent including zero", () => {
    expect(formatDirectoryDuty({ dutyKind: "AD_VALOREM", dutyPct: 0 })).toBe("0%");
    expect(formatDirectoryDuty({ dutyKind: "AD_VALOREM", dutyPct: 5 })).toBe("5%");
  });

  it("prints specific duty with unit", () => {
    expect(
      formatDirectoryDuty({ dutyKind: "SPECIFIC", dutyRubPerUnit: 120, unit: "кг" }),
    ).toBe("120 ₽ / кг");
  });

  it("does not invent a rate", () => {
    expect(formatDirectoryDuty(null)).toBe("нет в НСИ");
    expect(formatDirectoryDuty({ dutyPct: null, dutyRubPerUnit: null })).toBe("нет в НСИ");
  });

  it("C30a: labels tws fill honestly", () => {
    expect(
      formatDirectoryDuty({ dutyKind: "AD_VALOREM", dutyPct: 5, source: "tws-csv" }),
    ).toBe("5% · ориентир TWS (не НСИ)");
  });
});

describe("directoryReadFromCard", () => {
  it("uses live VAT 22% / ПП 1637 and never 20%", () => {
    const card = assembleTnvedCard({
      row: {
        code: "8471300000",
        codeDisplay: "8471 30 000 0",
        titleRu: "машины вычислительные портативные массой не более 10 кг",
        isLeaf: true,
        level: 10,
        notes: "ноутбук",
        rates: [{ source: "ett-opendata", dutyKind: "AD_VALOREM", dutyPct: 0 }],
      },
      ancestors: [
        { code: "84", codeDisplay: "84", titleRu: "РЕАКТОРЫ ЯДЕРНЫЕ, КОТЛЫ", level: 2 },
      ],
    });
    const read = directoryReadFromCard(card);
    expect(read.hs).toBe("8471 30 000 0");
    expect(read.vatPct).toBe(22);
    expect(read.feeRule).toBe("ПП 1637");
    expect(read.dutyLabel).toBe("0%");
    expect(read.notes.join(" ")).toContain("НДС 22%");
    expect(read.notes.join(" ")).not.toContain("НДС 20%");
    expect(read.notes.join(" ")).toContain("ПП 1637");
    // Layer G: 8471 prefix may flag ecoFeePossible — still honest, never «Низкий».
    expect(read.riskLabel).toMatch(/уточнит брокер/i);
    expect(["ok", "warn"]).toContain(read.riskKind);
    expect(read.riskLabel).not.toContain("Низкий");
    expect(read.why).toMatch(/портативн/i);
  });

  it("uses alias why sentence, not the search-token line", () => {
    const read = directoryReadFromCard({
      code: "8471300000",
      codeDisplay: "8471 30 000 0",
      titleRu: "машины вычислительные портативные",
      notes: "Ноутбуки и аналоги массой не более 10 кг.\nноутбук, laptop, macbook",
      paymentsHint: { vatPct: 22, feeRule: "ПП 1637" },
    });
    expect(read.why).toMatch(/^Ноутбуки и аналоги/);
    expect(read.why).not.toContain("macbook");
  });

  it("does not use a long comma token list as why", () => {
    const read = directoryReadFromCard({
      code: "8471300000",
      codeDisplay: "8471 30 000 0",
      titleRu: "машины вычислительные портативные",
      notes: "ноутбук, laptop, notebook, macbook, компьютеры портативные, пк",
      paymentsHint: { vatPct: 22, feeRule: "ПП 1637" },
    });
    expect(read.why).toBe("машины вычислительные портативные");
  });

  it("warns on layer-G triggers without inventing Низкий", () => {
    const card = assembleTnvedCard({
      row: {
        code: "8703239029",
        codeDisplay: "8703 23 902 9",
        titleRu: "автомобили легковые",
        isLeaf: true,
        level: 10,
        notes: null,
        rates: [],
      },
      ancestors: [],
    });
    const read = directoryReadFromCard(card);
    expect(read.riskKind).toBe("warn");
    expect(read.riskLabel).toMatch(/акциз/);
    expect(read.riskLabel).toMatch(/утильсбор/);
    expect(read.riskLabel).toMatch(/уточнит брокер/i);
    expect(read.dutyLabel).toBe("нет в НСИ");
    expect(read.notes.join(" ")).toMatch(/нет в НСИ/i);
  });

  it("C30c: surfaces PSN explanation without using token soup as why", () => {
    const card = assembleTnvedCard({
      row: {
        code: "8471300000",
        codeDisplay: "8471 30 000 0",
        titleRu: "машины вычислительные портативные",
        isLeaf: true,
        level: 10,
        notes: "ноутбук, laptop, notebook, macbook",
        rates: [],
      },
      ancestors: [],
    });
    expect(card.explanation?.heading).toMatch(/84/);
    const read = directoryReadFromCard(card);
    expect(read.explanation?.excerpt).toMatch(/8471|вычислительн/i);
    expect(read.classificationDecisions).toEqual([]);
  });

  it("stub leaf title uses nearest ancestor as общее обозначение", () => {
    const read = directoryReadFromCard({
      code: "8471300000",
      codeDisplay: "8471 30 000 0",
      titleRu: "Прочие",
      paymentsHint: { vatPct: 22, feeRule: "ПП 1637" },
      ancestors: [
        { code: "84", codeDisplay: "84", titleRu: "РЕАКТОРЫ ЯДЕРНЫЕ, КОТЛЫ" },
        {
          code: "847130",
          codeDisplay: "8471 30",
          titleRu: "машины вычислительные портативные массой не более 10 кг",
        },
      ],
    });
    expect(read.titleIsGeneralDesignation).toBe(true);
    expect(read.title).toMatch(/портативн/i);
    expect(read.generalDesignationCode).toMatch(/8471/);
    expect(read.notes[0]).toMatch(/общее обозначение/i);
  });
});

describe("directory wizard prefill", () => {
  it("builds /cabinet/new query and description like lab prepareWizard", () => {
    expect(
      directoryWizardHref("/cabinet/new", {
        code: "8471300000",
        titleRu: "ноутбуки",
      }),
    ).toBe("/cabinet/new?hs=8471300000&desc=%D0%BD%D0%BE%D1%83%D1%82%D0%B1%D1%83%D0%BA%D0%B8");
    const prefill = directoryPrefillFromQuery("8471300000", "ноутбуки");
    expect(prefill?.hsHint).toBe("8471 30 000 0");
    expect(prefill?.description).toBe("ноутбуки\nКод ТН ВЭД: 8471 30 000 0");
  });

  it("returns null when both hs and desc are empty", () => {
    expect(directoryPrefillFromQuery("", "")).toBeNull();
  });
});
