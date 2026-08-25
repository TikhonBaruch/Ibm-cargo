import { describe, expect, it } from "vitest";
import { parseEttJson, parseEttPercent } from "../tnved-ett";
import { assembleTnvedCard, pickEttRate } from "../tnved";

describe("ETT parser (layer B)", () => {
  it("parses ad valorem percents and skips junk", () => {
    expect(parseEttPercent("0%")).toBe(0);
    expect(parseEttPercent("5")).toBe(5);
    expect(parseEttPercent("10,5 %")).toBe(10.5);
    expect(parseEttPercent("см. примечание")).toBeNull();
    expect(parseEttPercent("5–10%")).toBeNull();
  });

  it("reads kod/stavka rows and ignores KZ link-only dump", () => {
    const rows = parseEttJson([
      { kod: "8471 30 000 0", stavka: "0%" },
      { link: "https://eec.eaeunion.org/comission/department/catr/ett/" },
    ]);
    expect(rows).toEqual([
      expect.objectContaining({
        code: "8471300000",
        dutyKind: "AD_VALOREM",
        dutyPct: 0,
      }),
    ]);
  });
});

describe("TN VED card envelope", () => {
  it("mixes RF payments and leaves ETT null when no duty in directory", () => {
    const card = assembleTnvedCard({
      row: {
        code: "8471300000",
        codeDisplay: "8471 30 000 0",
        titleRu: "машины вычислительные портативные массой не более 10 кг",
        isLeaf: true,
        level: 10,
        notes: "ноутбук",
        rates: [{ source: "seed-demo-pack+fns-tnved4", vatPct: 22, dutyPct: null }],
      },
      ancestors: [
        { code: "84", codeDisplay: "84", titleRu: "РЕАКТОРЫ ЯДЕРНЫЕ, КОТЛЫ", level: 2 },
        { code: "8471", codeDisplay: "84 71", titleRu: "ВЫЧИСЛИТЕЛЬНЫЕ МАШИНЫ", level: 4 },
      ],
    });
    expect(card.rate).toBeNull();
    expect(card.paymentsHint).toEqual({ vatPct: 22, feeRule: "ПП 1637" });
    expect(card.measuresHint.excisePossible).toBe(false);
    expect(card.disclaimer).toMatch(/брокер/i);
    expect(card.ancestors).toHaveLength(2);
    expect(card.titleRu).toMatch(/портативн/i);
    expect(card.sources.map((s) => s.layer)).toEqual(["A", "B", "C", "D", "G"]);
  });

  it("flags NK 181 / PP 1291 prefixes without inventing a rate", () => {
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
    expect(card.measuresHint.excisePossible).toBe(true);
    expect(card.measuresHint.utilSborPossible).toBe(true);
    expect(card.rate).toBeNull();
  });

  it("prefers an ETT-sourced duty over vat-only seed", () => {
    expect(
      pickEttRate([
        { source: "seed-demo-pack+fns-tnved4", dutyPct: null, vatPct: 22 },
        { source: "ett-opendata", dutyKind: "AD_VALOREM", dutyPct: 0 },
      ])
    ).toMatchObject({ dutyPct: 0, source: "ett-opendata" });
  });

  it("uses tws-csv fill when no NSI/ETT row exists", () => {
    expect(
      pickEttRate([{ source: "tws-csv", dutyKind: "AD_VALOREM", dutyPct: 5 }])
    ).toMatchObject({ dutyPct: 5, source: "tws-csv" });
  });
});
