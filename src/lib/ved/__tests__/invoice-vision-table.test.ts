import { describe, expect, it, vi, afterEach } from "vitest";
import {
  extractInvoiceTableForChain,
  importPreviewAllowsEmptyRows,
  invoiceItemsFromVisionJson,
  normalizeImageBase64,
  parseInvoiceVisionJson,
  sheetTableFromInvoiceItems,
} from "../invoice-vision-table";
import { mapCsvToRows } from "../product-import";

describe("invoice vision JSON → SheetTable", () => {
  it("maps items[] to name/description rows", () => {
    const items = invoiceItemsFromVisionJson({
      items: [
        { name: "Носки хлопок", qty: 10, unitPrice: 1.2 },
        { name: "Футболка", description: "100% cotton" },
      ],
    });
    expect(items).toHaveLength(2);
    const table = sheetTableFromInvoiceItems(items);
    const rows = mapCsvToRows(table.headers, table.rows);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.name).toBe("Носки хлопок");
    expect(rows[1]?.description).toMatch(/cotton/);
  });

  it("parses fenced JSON and ignores empty names", () => {
    const raw = '```json\n{"items":[{"name":"A"},{"name":"  "},{"title":"B"}]}\n```';
    const items = parseInvoiceVisionJson(raw);
    expect(items.map((i) => i.name)).toEqual(["A", "B"]);
  });

  it("returns [] for broken JSON", () => {
    expect(parseInvoiceVisionJson("not json")).toEqual([]);
    expect(invoiceItemsFromVisionJson(null)).toEqual([]);
  });

  it("strips data-url prefix from base64", () => {
    expect(normalizeImageBase64("data:image/jpeg;base64,abc")).toBe("abc");
    expect(normalizeImageBase64("abc")).toBe("abc");
  });

  it("allows empty preview only for image source", () => {
    expect(importPreviewAllowsEmptyRows("image")).toBe(true);
    expect(importPreviewAllowsEmptyRows("sheet")).toBe(false);
  });
});

describe("extractInvoiceTableForChain", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns null when vision is not configured", async () => {
    const out = await extractInvoiceTableForChain(
      { imageBase64: "a".repeat(40), mimeType: "image/jpeg" },
      { AI_CHAIN_ID: "3" }
    );
    expect(out).toBeNull();
  });

  it("mesh: parses table JSON without calling describe prompt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [{ name: "Кабель USB", qty: 2, unitPrice: 3 }],
                }),
              },
            },
          ],
        }),
      })
    );
    const out = await extractInvoiceTableForChain(
      { imageBase64: "a".repeat(40), mimeType: "image/jpeg" },
      { AI_CHAIN_ID: "3", DEEPSEEK_API_KEY: "sk-test" }
    );
    expect(out?.attempted).toBe(true);
    expect(out?.table.rows[0]?.[0]).toBe("Кабель USB");
    const body = JSON.parse(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body));
    expect(String(body.messages[0].content[0].text)).toMatch(/line items/i);
    expect(String(body.messages[0].content[0].text)).not.toMatch(/Опиши товар/);
  });
});
