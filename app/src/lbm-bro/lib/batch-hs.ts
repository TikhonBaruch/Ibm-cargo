import { parseDelimited as parseDelimitedRows } from "./pack-rows";
import { classifyProduct, type ClassifyResult, type TnvedData } from "./tnved-lookup";
import { buildClassificationQuery } from "./product-copy";
import type { HsLine, OrderDoc } from "./types";

export const MIN_PACK = 2;
export const MAX_PACK = 100;

export function clampPack(n: number) {
  if (!Number.isFinite(n) || n < MIN_PACK) return 0;
  return Math.min(MAX_PACK, Math.round(n));
}

const EMPTY: ClassifyResult = {
  hs: "—",
  why: "По названию не хватило признаков для однозначного кода ТН ВЭД ЕАЭС. Уточните материал, назначение и состав.",
  risk: "Нужно уточнение",
  conf: 0,
};

export function classifyName(name: string, data?: TnvedData | null, docs?: OrderDoc[]): ClassifyResult {
  if (!data) return EMPTY;
  const query = docs?.length ? buildClassificationQuery(name, docs) : name;
  return classifyProduct(data, query);
}

export function parseDelimited(text: string) {
  return parseDelimitedRows(text);
}

export function extractedFromDocs(docs: { packLines?: { name: string; qty?: string; price?: string }[] }[]) {
  return docs.flatMap((d) => d.packLines || []);
}

export function recognizeRows(docs: {
  name: string;
  packLines?: { name: string; qty?: string; price?: string }[];
  packSource?: "csv" | "xlsx" | "pdf" | "ocr";
}[]) {
  const extracted = extractedFromDocs(docs);
  if (extracted.length) {
    const src = docs.find((d) => d.packLines?.length)?.packSource;
    return {
      rows: extracted.slice(0, MAX_PACK),
      source: src === "ocr" ? "ocr" as const : "file" as const,
    };
  }
  return { rows: [] as { name: string; qty?: string; price?: string }[], source: "none" as const };
}

export function buildPackLines(
  count: number,
  currency: string,
  extracted?: { name: string; qty?: string; price?: string }[],
): HsLine[] {
  const n = clampPack(count);
  if (!n) return [];
  const src = (extracted && extracted.length ? extracted : []).slice(0, n);
  const rows = [...src];
  while (rows.length < n) {
    rows.push({ name: `Позиция ${rows.length + 1}`, qty: "", price: "" });
  }
  return rows.slice(0, n).map((row, i) => ({
    id: `l-${i + 1}`,
    n: i + 1,
    name: row.name,
    qty: row.qty || "",
    price: row.price || "",
    currency,
    hs: "—",
    conf: 0,
    why: "",
    risk: "—",
    status: "wait",
  }));
}

export function codePackLines(lines: HsLine[], data: TnvedData): HsLine[] {
  return lines.map((line) => {
    const c = classifyName(line.name, data);
    return { ...line, ...c, status: "ok" };
  });
}

export function packInvoiceSum(lines: HsLine[]) {
  return lines.reduce((s, l) => s + (Number(String(l.price).replace(",", ".")) || 0), 0);
}

export function resolvePack(
  mode: "single" | "multi",
  packSize: number,
  docs: { name: string; packLines?: { name: string; qty?: string; price?: string }[] }[],
  currency: string,
  current: HsLine[] = [],
) {
  if (mode !== "multi") return { packSize: 0, lines: [] as HsLine[] };
  const rec = recognizeRows(docs);
  const size = rec.rows.length >= MIN_PACK ? rec.rows.length : clampPack(packSize);
  if (!size) return { packSize: 0, lines: [] as HsLine[] };
  const reuse = current.length === size && current.every((l) => l.name);
  const lines = reuse
    ? current.map((l) => ({ ...l, hs: "—", conf: 0, why: "", status: "wait" as const }))
    : buildPackLines(size, currency, rec.rows);
  return { packSize: size, lines };
}

export function packStats(lines: HsLine[]) {
  const ok = lines.filter((l) => l.status === "ok" && l.hs && l.hs !== "—");
  const conf = ok.length ? Math.round(ok.reduce((s, l) => s + l.conf, 0) / ok.length) : 0;
  const hs = ok[0]?.hs || "—";
  return {
    hs,
    conf,
    why: ok.length
      ? `Подобраны коды ТН ВЭД по ${ok.length} позициям инвойса. Первый код ${hs}. Остальные — в таблице заявки.`
      : "Коды по позициям появятся после обработки.",
    risk: ok.some((l) => /средн|марк|сертиф|честн|IMEI|нотиф/i.test(l.risk)) ? "Есть позиции с риском" : "Низкий",
  };
}
