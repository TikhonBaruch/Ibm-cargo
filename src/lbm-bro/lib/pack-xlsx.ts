import { unzipSync, strFromU8 } from "fflate";
import { type PackRow, rowsFromTable } from "./pack-rows";

function colIndex(ref: string) {
  const letters = ref.replace(/\d/g, "");
  let n = 0;
  for (let i = 0; i < letters.length; i += 1) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}

function rowIndex(ref: string) {
  return Number(ref.replace(/\D/g, "")) - 1;
}

function xmlTexts(block: string) {
  return [...block.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => decodeXml(m[1])).join("");
}

function decodeXml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function sharedStrings(xml: string) {
  const parts = xml.split(/<si[ >]/).slice(1);
  return parts.map((p) => xmlTexts(p.split("</si>")[0] || ""));
}

function sheetToTable(xml: string, strings: string[]) {
  const cells = [...xml.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)];
  let maxR = 0;
  let maxC = 0;
  const grid = new Map<string, string>();
  for (const [, attrs, body] of cells) {
    const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
    if (!ref) continue;
    const t = attrs.match(/\bt="([^"]+)"/)?.[1] || "";
    const v = body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] || "";
    const inline = xmlTexts(body);
    let val = "";
    if (t === "s") val = strings[Number(v)] || "";
    else if (t === "inlineStr") val = inline;
    else val = decodeXml(inline || v);
    grid.set(ref, val.trim());
    maxR = Math.max(maxR, rowIndex(ref));
    maxC = Math.max(maxC, colIndex(ref));
  }
  const table: string[][] = [];
  for (let r = 0; r <= maxR; r += 1) {
    const row: string[] = [];
    for (let c = 0; c <= maxC; c += 1) {
      const ref = `${colLetter(c)}${r + 1}`;
      row.push(grid.get(ref) || "");
    }
    if (row.some((x) => x)) table.push(row);
  }
  return table;
}

function colLetter(n: number) {
  let s = "";
  let x = n + 1;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

export function parseXlsxBuffer(buf: Uint8Array): PackRow[] {
  const files = unzipSync(buf);
  const names = Object.keys(files);
  const ssFile = names.find((n) => /xl\/sharedStrings\.xml$/i.test(n));
  const strings = ssFile ? sharedStrings(strFromU8(files[ssFile])) : [];
  const sheets = names.filter((n) => /xl\/worksheets\/sheet\d+\.xml$/i.test(n)).sort();
  let best: PackRow[] = [];
  for (const sheet of sheets) {
    const rows = rowsFromTable(sheetToTable(strFromU8(files[sheet]), strings));
    if (rows.length > best.length) best = rows;
  }
  return best;
}
