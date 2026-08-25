/**
 * Shared PDF/OCR table heuristics — text → SheetTable for product import.
 * Used by product-import (local) and mirrored in containers/ocr.
 */

export type SheetTable = { headers: string[]; rows: string[][] };

const HEADER_HINT =
  /наимен|naimenovan|name|товар|description|описание|qty|кол|cena|цена|price|бренд|brand|артикул|sku/i;

/** Split a line into cells by ; , or tab (prefer the delimiter that yields ≥2 cells). */
export function splitTableLine(line: string): string[] {
  const raw = String(line || "").trim();
  if (!raw) return [];
  const candidates = [
    raw.split(";").map((c) => c.trim()),
    raw.split("\t").map((c) => c.trim()),
    raw.split(",").map((c) => c.trim()),
  ];
  let best = candidates[0];
  for (const c of candidates) {
    if (c.length > best.length) best = c;
  }
  if (best.length >= 2) return best;
  // "Name  2  100.00" — multi-space columns
  const spaced = raw.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
  if (spaced.length >= 2) return spaced;
  return [raw];
}

/**
 * Build SheetTable from plain text (invoice / packing list dump).
 * Looks for a header-ish line, else treats each non-empty line as a single-column name.
 */
export function sheetTableFromText(text: string): SheetTable {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^page\s+\d+/i.test(l));

  if (!lines.length) return { headers: [], rows: [] };

  let headerIdx = lines.findIndex((l) => HEADER_HINT.test(l) && splitTableLine(l).length >= 2);
  if (headerIdx < 0) {
    // No explicit header — invent name column from product-looking lines
    const productLines = lines.filter((l) => {
      if (/^(invoice|packing|total|итого|сумма|дата|date|№|n[oо]\.?)/i.test(l)) return false;
      if (/^\d+([.,]\d+)?\s*(usd|eur|rub|₽|\$)?$/i.test(l)) return false;
      return l.length >= 3;
    });
    const rows = productLines.slice(0, 200).map((l) => {
      const cells = splitTableLine(l);
      if (cells.length >= 2) return cells;
      return [l];
    });
    const maxCols = Math.max(1, ...rows.map((r) => r.length));
    const headers = ["name", ...Array.from({ length: maxCols - 1 }, (_, i) => `col${i + 2}`)];
    // If second col looks numeric → unitPrice
    if (maxCols >= 2 && rows.some((r) => /^\d+([.,]\d+)?$/.test(r[1] || ""))) {
      headers[1] = "цена";
    }
    if (maxCols >= 3 && rows.some((r) => /^\d+([.,]\d+)?$/.test(r[2] || ""))) {
      headers[2] = "количество";
    }
    return {
      headers,
      rows: rows.map((r) => {
        const padded = [...r];
        while (padded.length < maxCols) padded.push("");
        return padded;
      }),
    };
  }

  const headers = splitTableLine(lines[headerIdx]).map((h) => h.toLowerCase());
  const rows = lines
    .slice(headerIdx + 1, headerIdx + 201)
    .map(splitTableLine)
    .filter((cells) => cells.some((c) => c.length > 0))
    .map((cells) => {
      const padded = [...cells];
      while (padded.length < headers.length) padded.push("");
      return padded.slice(0, headers.length);
    });
  return { headers, rows };
}

/** Heuristic brand/model from free text for single-item OCR attrs. */
export function attrsFromOcrText(text: string): Record<string, string> {
  const t = String(text || "");
  const attrs: Record<string, string> = {};
  const brand =
    t.match(/\b(Apple|Lenovo|Samsung|Xiaomi|Huawei|Dell|HP|Asus|Acer|Sony|Nike|Adidas)\b/i)?.[1] ||
    t.match(/бренд[:\s]+([A-Za-zА-Яа-я0-9\-]+)/i)?.[1];
  if (brand) attrs.brand = brand;
  const model =
    t.match(/\b(MacBook\s+Pro(?:\s+\d+)?|iPhone\s+\d+\s*\w*|ThinkPad\s+\w+|Galaxy\s+\w+)/i)?.[0] ||
    t.match(/модель[:\s]+([A-Za-zА-Яа-я0-9\-\s]+)/i)?.[1];
  if (model) attrs.model = model.trim().slice(0, 80);
  const purpose = t.match(/\b(ноутбук|смартфон|монитор|наушники|планшет|laptop|smartphone)\b/i)?.[1];
  if (purpose) attrs.purpose = purpose.toLowerCase();
  return attrs;
}
