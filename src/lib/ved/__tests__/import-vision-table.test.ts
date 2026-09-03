import { describe, expect, it } from "vitest";
import {
  isImageImportFilename,
  sheetTableFromVisionItems,
  visionImportConfigured,
} from "../import-vision-table";

describe("import-vision-table (C37)", () => {
  it("detects image filenames / mime", () => {
    expect(isImageImportFilename("invoice.png")).toBe(true);
    expect(isImageImportFilename("a.JPG")).toBe(true);
    expect(isImageImportFilename("x.csv")).toBe(false);
    expect(isImageImportFilename("blob", "image/jpeg")).toBe(true);
  });

  it("builds SheetTable for mapCsvToRows", () => {
    const table = sheetTableFromVisionItems([
      { name: "Носки", description: "хлопок", qty: 10, unitPrice: 1.5 },
      { name: "Футболка", qty: 2 },
    ]);
    expect(table.headers).toEqual(["name", "description", "qty", "цена"]);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]?.[0]).toBe("Носки");
    expect(table.rows[0]?.[2]).toBe("10");
  });

  it("visionImportConfigured requires DeepSeek key", () => {
    expect(visionImportConfigured({})).toBe(false);
    expect(visionImportConfigured({ DEEPSEEK_API_KEY: "sk-test" })).toBe(true);
  });
});
