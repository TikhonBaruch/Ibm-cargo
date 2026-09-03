/**
 * @see docs/knowledge/plan-tnved-fts-pr.md
 */
import { describe, expect, it } from "vitest";
import {
  buildFtsPrNotesPatch,
  digits10,
  fingerprintDescription,
  parseAsOfFromFileName,
  pickCurrentSourceFile,
  rowsFromSheetObjects,
  stripFtsPrWhy,
  summarizeReconcile,
  tokensFromFtsDescription,
  FTS_PR_WHY_MARKER,
} from "../tnved-fts-pr";

describe("tnved-fts-pr", () => {
  it("normalizes 10-digit codes with spaces", () => {
    expect(digits10("8471 30 000 0")).toBe("8471300000");
    expect(digits10("84713")).toBe("");
  });

  it("parses canon4 sheet objects", () => {
    const wb = rowsFromSheetObjects([
      {
        "Код товара по ТН ВЭД ЕАЭС": "7607 20 100 0",
        "Описание товара": "Фольга алюминиевая на бумажной основе",
        Страна: "CN",
        "Обоснование принятия решения": "ОПИ 1",
      },
    ]);
    expect(wb.schemaKind).toBe("canon4");
    expect(wb.rows[0].code).toBe("7607201000");
    expect(wb.uniqueCodes).toBe(1);
    expect(wb.rows[0].descFingerprint).toBe(
      fingerprintDescription("Фольга алюминиевая на бумажной основе"),
    );
  });

  it("picks latest CRU workbook as current", () => {
    expect(
      pickCurrentSourceFile(["CRU20240711.xls", "CRU20260711.xls", "C_RU_2022_12_1-1.xls"]),
    ).toBe("CRU20260711.xls");
  });

  it("parses asOf from CRU name", () => {
    expect(parseAsOfFromFileName("CRU20260711.xls")?.toISOString().slice(0, 10)).toBe("2026-07-11");
  });

  it("builds idempotent notes overlay without touching prior why twice", () => {
    const first = buildFtsPrNotesPatch("psn tokens here", 3, ["фольга", "алюминиевая"]);
    expect(first).toContain(FTS_PR_WHY_MARKER);
    expect(first).toContain("фольга");
    const second = buildFtsPrNotesPatch(first, 3, ["фольга", "алюминиевая"]);
    expect(second?.split(FTS_PR_WHY_MARKER).length).toBe(2);
    expect(stripFtsPrWhy(second)).not.toContain(FTS_PR_WHY_MARKER);
  });

  it("extracts lexical tokens and drops stopwords", () => {
    const toks = tokensFromFtsDescription("Набор для детского творчества фетровая сумочка наклейки", 10);
    expect(toks).toContain("детского");
    expect(toks).not.toContain("для");
  });

  it("reconcile flags missing and inactive", () => {
    const s = summarizeReconcile({
      currentFile: "CRU20260711.xls",
      codes: ["8471300000", "8471300000", "9999999999", "6109100000"],
      main: new Map([
        ["8471300000", { isActive: true }],
        ["6109100000", { isActive: false }],
      ]),
    });
    expect(s.uniqueCodes).toBe(3);
    expect(s.missingInMain).toEqual(["9999999999"]);
    expect(s.inactiveInMain).toEqual(["6109100000"]);
    expect(s.presentActive).toBe(1);
  });
});
