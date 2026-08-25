/**
 * Product table import — CSV / XLSX / PDF parse + per-row classify (precedent → LLM).
 */
import * as XLSX from "xlsx";
import { extractText, getDocumentProxy } from "unpdf";
import type { ProductAttrs } from "./product-description";
import { sanitizeProductAttrs } from "./product-description";
import type { PrecedentMatchInput } from "./verified-determinations";
import { sheetTableFromText, type SheetTable } from "./pdf-table";

export type { SheetTable } from "./pdf-table";
export { sheetTableFromText } from "./pdf-table";

export type ParsedImportRow = {
  rowIndex: number;
  name: string;
  description?: string;
  qty?: number;
  unitPrice?: number;
  currency?: string;
  attrs?: ProductAttrs;
  parseWarnings: string[];
};

export type ClassifiedImportRow = ParsedImportRow & {
  rowStatus: "MATCHED_PRECEDENT" | "CLASSIFIED_NEW" | "PARSE_ERROR" | "LOW_CONFIDENCE";
  hsCode?: string;
  confidence?: number;
  engine?: string;
  llmEnrich?: string;
};

/** Minimal RFC4180-ish CSV parser (quoted fields). */
export function parseProductCsv(text: string): SheetTable {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if ((ch === "," || ch === ";") && !inQ) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

/** First sheet → headers + string rows (max 200 data rows). */
export function parseProductXlsx(buffer: ArrayBuffer | Buffer): SheetTable {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as (string | number | boolean | null)[][];
  if (!matrix.length) return { headers: [], rows: [] };
  const headers = (matrix[0] || []).map((c) => String(c ?? "").trim().toLowerCase());
  const rows = matrix
    .slice(1, 201)
    .map((r) => headers.map((_, i) => String(r[i] ?? "").trim()));
  return { headers, rows };
}

export function isXlsxFilename(name: string): boolean {
  return /\.xlsx$/i.test(name) || /\.xls$/i.test(name);
}

export function isPdfFilename(name: string): boolean {
  return /\.pdf$/i.test(name);
}

/** Text-layer PDF → SheetTable (invoice / packing list). Empty if no extractable text. */
export async function parseProductPdf(
  buffer: ArrayBuffer | Buffer
): Promise<SheetTable> {
  try {
    const bytes =
      buffer instanceof Buffer
        ? new Uint8Array(buffer)
        : new Uint8Array(buffer);
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const joined = Array.isArray(text) ? text.join("\n") : String(text || "");
    return sheetTableFromText(joined);
  } catch {
    return { headers: [], rows: [] };
  }
}

const COLUMN_ALIASES: Record<string, string> = {
  name: "name",
  title: "name",
  description: "description",
  qty: "qty",
  unitprice: "unitPrice",
  price: "unitPrice",
  currency: "currency",
  brand: "brand",
  sku: "sku",
  material: "material",
  purpose: "purpose",
  model: "model",
  наименование: "name",
  naimenovanie: "name",
  товар: "name",
  описание: "description",
  количество: "qty",
  колво: "qty",
  цена: "unitPrice",
  cena: "unitPrice",
  валюта: "currency",
  бренд: "brand",
  артикул: "sku",
  материал: "material",
};

function headerKey(h: string): string {
  return h.replace(/\s+/g, "").toLowerCase();
}

export function mapCsvToRows(
  headers: string[],
  rows: string[][],
  mapping?: Record<string, string>
): ParsedImportRow[] {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = mapping?.[h] || COLUMN_ALIASES[headerKey(h)] || headerKey(h);
    if (key === "name" || key === "description" || key === "qty" || key === "unitPrice" || key === "currency") {
      idx[key] = i;
    } else if (["brand", "sku", "material", "purpose", "model"].includes(String(key))) {
      idx[`attr:${key}`] = i;
    }
  });

  const nameCol = idx.name ?? headers.findIndex((h) => /наимен|naimenovan|name|товар/i.test(h));
  if (nameCol < 0) return [];

  return rows
    .map((cells, rowIndex) => {
      const warnings: string[] = [];
      const name = (cells[nameCol] || "").trim();
      if (!name) warnings.push("empty name");

      const attrs: ProductAttrs = {};
      for (const [k, col] of Object.entries(idx)) {
        if (!k.startsWith("attr:")) continue;
        const field = k.slice(5);
        const v = (cells[col] || "").trim();
        if (!v) continue;
        if (field === "sku") {
          attrs.extra = { ...(attrs.extra || {}), sku: v };
        } else if (
          field === "brand" ||
          field === "material" ||
          field === "purpose" ||
          field === "model"
        ) {
          (attrs as Record<string, string>)[field] = v;
        }
      }
      const sanitized = sanitizeProductAttrs(attrs);

      const qtyRaw = idx.qty != null ? cells[idx.qty] : undefined;
      const priceRaw = idx.unitPrice != null ? cells[idx.unitPrice] : undefined;
      const qty = qtyRaw ? Number(String(qtyRaw).replace(",", ".")) : undefined;
      const unitPrice = priceRaw ? Number(String(priceRaw).replace(",", ".")) : undefined;

      return {
        rowIndex: rowIndex + 1,
        name,
        description: idx.description != null ? cells[idx.description]?.trim() : undefined,
        qty: qty && qty > 0 ? qty : undefined,
        unitPrice: unitPrice != null && unitPrice >= 0 ? unitPrice : undefined,
        currency: idx.currency != null ? cells[idx.currency]?.trim() : undefined,
        attrs: sanitized,
        parseWarnings: warnings,
      };
    })
    .filter((r) => r.name.length > 0);
}

export type ClassifyRowDeps = {
  findPrecedent: (input: PrecedentMatchInput) => Promise<{
    hsCode: string;
    confidence: number;
    engine: string;
  } | null>;
  classifyLlm: (input: PrecedentMatchInput) => Promise<{
    hsCode: string;
    confidence: number;
    engine: string;
  } | null>;
  lowConfidenceThreshold?: number;
};

/** Per-row: precedent first, then LLM classify. Fail-open per row. */
export async function classifyImportRows(
  rows: ParsedImportRow[],
  deps: ClassifyRowDeps
): Promise<ClassifiedImportRow[]> {
  const low = deps.lowConfidenceThreshold ?? 0.55;
  const out: ClassifiedImportRow[] = [];

  for (const row of rows) {
    if (row.parseWarnings.includes("empty name")) {
      out.push({ ...row, rowStatus: "PARSE_ERROR" });
      continue;
    }
    const input: PrecedentMatchInput = {
      name: row.name,
      description: row.description,
      attrs: row.attrs,
    };
    try {
      const prec = await deps.findPrecedent(input);
      if (prec) {
        out.push({
          ...row,
          rowStatus: "MATCHED_PRECEDENT",
          hsCode: prec.hsCode,
          confidence: prec.confidence,
          engine: prec.engine,
          llmEnrich: prec.engine,
        });
        continue;
      }
      const llm = await deps.classifyLlm(input);
      if (llm) {
        out.push({
          ...row,
          rowStatus: llm.confidence < low ? "LOW_CONFIDENCE" : "CLASSIFIED_NEW",
          hsCode: llm.hsCode,
          confidence: llm.confidence,
          engine: llm.engine,
          llmEnrich: llm.engine,
        });
        continue;
      }
      out.push({ ...row, rowStatus: "LOW_CONFIDENCE" });
    } catch {
      out.push({ ...row, rowStatus: "LOW_CONFIDENCE" });
    }
  }
  return out;
}
