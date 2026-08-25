import { describe, it, expect, vi } from "vitest";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  parseProductCsv,
  parseProductXlsx,
  parseProductPdf,
  mapCsvToRows,
  classifyImportRows,
  isXlsxFilename,
  isPdfFilename,
} from "../product-import";
import { sheetTableFromText, attrsFromOcrText } from "../pdf-table";

describe("product-import", () => {
  it("parseProductCsv handles semicolon delimiter", () => {
    const { headers, rows } = parseProductCsv(
      "Наименование;Количество;Цена\nMacBook;1;2000\niPhone;2;800"
    );
    expect(headers[0]).toContain("наимен");
    expect(rows).toHaveLength(2);
  });

  it("mapCsvToRows maps Russian headers", () => {
    const { headers, rows } = parseProductCsv(
      "Наименование,Описание,Бренд\nНоутбук Apple,14 дюймов,Apple"
    );
    const mapped = mapCsvToRows(headers, rows);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].name).toBe("Ноутбук Apple");
    expect(mapped[0].attrs?.brand).toBe("Apple");
  });

  it("parseProductXlsx reads first sheet", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Наименование", "Цена"],
      ["MacBook Pro", 2000],
      ["iPhone", 800],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const { headers, rows } = parseProductXlsx(buf);
    const mapped = mapCsvToRows(headers, rows);
    expect(mapped).toHaveLength(2);
    expect(mapped[0].name).toBe("MacBook Pro");
    expect(mapped[0].unitPrice).toBe(2000);
  });

  it("isXlsxFilename", () => {
    expect(isXlsxFilename("a.xlsx")).toBe(true);
    expect(isXlsxFilename("a.CSV")).toBe(false);
  });

  it("isPdfFilename", () => {
    expect(isPdfFilename("invoice.PDF")).toBe(true);
    expect(isPdfFilename("a.csv")).toBe(false);
  });

  it("sheetTableFromText parses semicolon invoice", () => {
    const table = sheetTableFromText(
      "Invoice\nНаименование;Цена\nMacBook Pro;2000\niPhone 15;800"
    );
    const mapped = mapCsvToRows(table.headers, table.rows);
    expect(mapped).toHaveLength(2);
    expect(mapped[0].name).toBe("MacBook Pro");
    expect(mapped[0].unitPrice).toBe(2000);
  });

  it("attrsFromOcrText picks brand/model", () => {
    const a = attrsFromOcrText("Apple MacBook Pro laptop for import");
    expect(a.brand).toBe("Apple");
    expect(a.model?.toLowerCase()).toContain("macbook");
  });

  it("parseProductPdf extracts table from text-layer PDF", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 200]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText("Naimenovanie;Cena", { x: 20, y: 160, size: 12, font });
    page.drawText("MacBook Pro;2000", { x: 20, y: 140, size: 12, font });
    page.drawText("iPhone 15;800", { x: 20, y: 120, size: 12, font });
    const bytes = await doc.save();
    const table = await parseProductPdf(Buffer.from(bytes));
    const mapped = mapCsvToRows(table.headers, table.rows);
    expect(mapped.length).toBeGreaterThanOrEqual(2);
    expect(mapped[0].name.toLowerCase()).toContain("macbook");
  });

  it("classifyImportRows prefers precedent", async () => {
    const rows = mapCsvToRows(["name"], [["MacBook Pro"]]);
    const findPrecedent = vi.fn().mockResolvedValue({
      hsCode: "8471 30 000 0",
      confidence: 0.95,
      engine: "precedent-v1",
    });
    const classifyLlm = vi.fn();
    const result = await classifyImportRows(rows, { findPrecedent, classifyLlm });
    expect(result[0].rowStatus).toBe("MATCHED_PRECEDENT");
    expect(classifyLlm).not.toHaveBeenCalled();
  });

  it("classifyImportRows falls back to LLM", async () => {
    const rows = mapCsvToRows(["name"], [["Unknown gadget"]]);
    const findPrecedent = vi.fn().mockResolvedValue(null);
    const classifyLlm = vi.fn().mockResolvedValue({
      hsCode: "8517 13 000 0",
      confidence: 0.8,
      engine: "llm-openai-v1",
    });
    const result = await classifyImportRows(rows, { findPrecedent, classifyLlm });
    expect(result[0].rowStatus).toBe("CLASSIFIED_NEW");
    expect(result[0].hsCode).toBe("8517 13 000 0");
  });
});
