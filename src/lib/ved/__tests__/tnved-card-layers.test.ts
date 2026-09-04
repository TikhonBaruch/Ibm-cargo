import { describe, expect, it } from "vitest";
import {
  classificationDecisionsFromItems,
  dutySourceNote,
  formatCardDutyLabel,
  lookupPsnExplanation,
  parsePsnFromNotes,
} from "../tnved-card-layers";

describe("C30a honest duty labels", () => {
  it("says нет в НСИ when rate missing", () => {
    expect(formatCardDutyLabel(null)).toBe("нет в НСИ");
    expect(formatCardDutyLabel({ dutyPct: null, dutyRubPerUnit: null })).toBe("нет в НСИ");
    expect(dutySourceNote(null)).toMatch(/нет в НСИ/i);
  });

  it("marks tws-csv as ориентир TWS, not NSI", () => {
    expect(
      formatCardDutyLabel({
        dutyKind: "AD_VALOREM",
        dutyPct: 5,
        source: "tws-csv",
      }),
    ).toBe("5% · ориентир TWS (не НСИ)");
    expect(
      dutySourceNote({ dutyKind: "AD_VALOREM", dutyPct: 5, source: "tws-csv" }),
    ).toMatch(/ориентир TWS/i);
  });

  it("prints NSI/ETT percent without TWS tag", () => {
    expect(
      formatCardDutyLabel({
        dutyKind: "AD_VALOREM",
        dutyPct: 0,
        source: "ett-opendata",
      }),
    ).toBe("0%");
  });
});

describe("C30c PSN explanation", () => {
  it("parses ЕЭК PSN notes line", () => {
    const hit = parsePsnFromNotes(
      "ЕЭК PSN: Группа 84. Вычислительные машины — см. позицию 8471.\nноутбук, laptop",
    );
    expect(hit?.heading).toMatch(/Группа 84/);
    expect(hit?.excerpt).toMatch(/8471/);
    expect(hit?.origin).toBe("notes");
  });

  it("falls back to must-cover overlay by group", () => {
    const hit = lookupPsnExplanation({ code: "8471300000", notes: null, ancestors: [] });
    expect(hit?.origin).toBe("overlay");
    expect(hit?.heading).toMatch(/84/);
    expect(hit?.excerpt.length).toBeGreaterThan(40);
  });

  it("prefers ancestor notes over overlay", () => {
    const hit = lookupPsnExplanation({
      code: "8471300000",
      notes: "ноутбук, laptop",
      ancestors: [
        {
          code: "84",
          level: 2,
          notes: "ЕЭК PSN: Группа 84 — из compose. Текст из notes.jsonl после tnved:compose.",
        },
      ],
    });
    expect(hit?.origin).toBe("notes");
    expect(hit?.excerpt).toMatch(/notes\.jsonl/);
  });
});

describe("C30d classification decisions", () => {
  it("returns empty when shipped index has no hit (fail-open)", () => {
    expect(classificationDecisionsFromItems([], "8471300000")).toEqual([]);
  });

  it("joins by 10-digit when items provided", () => {
    const hits = classificationDecisionsFromItems(
      [
        {
          code: "8471300000",
          title: "Пример решения о классификации ноутбуков",
          url: "https://eec.eaeunion.org/example",
          asOf: "2024-01-01",
        },
      ],
      "8471 30 000 0",
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].title).toMatch(/ноутбуков/);
  });
});
