export type PackRow = { name: string; qty?: string; price?: string };

const SKIP =
  /^(invoice|инвойс|packing|pack(?:ing)?\s*list|пэкинг|total|итого|сумма|subtotal|grand\s*total|всего|balance|date|дата|page|стр\.?|tel|phone|fax|address|адрес|from|to|shipper|consignee|продавец|покупатель|contract|контракт|currency|валюта|unit\s*price|description|наименование|qty|quantity)$/i;

const HEADER = {
  name: /name|товар|наим|desc|item|позиц|goods|product|sku|артикул|品名|名称|goods?\s*name|description/i,
  qty: /qty|кол|шт|quantity|pcs|ctn|数量|件数|кол-во|q'ty|q’ty/i,
  price: /price|цена|unit\s*p|单价|amount|стоим|value|сумма|金额/i,
  unit: /unit\s*p|цена\s*(ед|за)|unit\s*price|单价/i,
};

export function detectSeparator(text: string) {
  const line = text.split(/\r?\n/).find((l) => l.trim()) || "";
  const tab = (line.match(/\t/g) || []).length;
  const semi = (line.match(/;/g) || []).length;
  const comma = (line.match(/,/g) || []).length;
  if (tab >= semi && tab >= comma && tab > 0) return "\t";
  if (semi > comma) return ";";
  return ",";
}

export function splitCsvLine(line: string, sep: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && ch === sep) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function parseCsvTable(text: string): string[][] {
  const sep = detectSeparator(text);
  return text
    .split(/\r?\n/)
    .map((line) => splitCsvLine(line, sep))
    .filter((row) => row.some((c) => c));
}

function headerIndex(head: string[], re: RegExp) {
  return head.findIndex((h) => re.test(h));
}

function looksNumeric(s: string) {
  return parseMoney(s) != null;
}

export function parseMoney(raw: string) {
  const t = String(raw || "")
    .replace(/\s/g, "")
    .replace(/[$€¥₽]|USD|EUR|CNY|RUB|USDT?/gi, "")
    .replace(/pcs|pc|шт|кг|kg|ctn|box|箱|件/gi, "");
  if (!t || !/^\d{1,3}([ ,]\d{3})*([.,]\d+)?$|^\d+([.,]\d+)?$/.test(t)) return null;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  let n = t;
  if (lastComma >= 0 && lastDot >= 0) {
    n = lastComma > lastDot ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const frac = t.length - lastComma - 1;
    n = frac <= 2 ? t.replace(",", ".") : t.replace(/,/g, "");
  }
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function cleanName(s: string) {
  let t = s
    .replace(/^\d{1,4}[\).:-]\s*/, "")
    .replace(/^№\s*\d+\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = t.split(" ");
  if (
    parts.length >= 2
    && /^\d{1,3}$/.test(parts[0])
    && !/^(inch|in|см|mm|мм|gb|tb|mah|w|v|kg|кг|ml|мл|oz|pcs)$/i.test(parts[1])
  ) {
    t = parts.slice(1).join(" ");
  }
  return t;
}

function hasLetter(s: string) {
  return /[a-zа-яё\u4e00-\u9fff]/i.test(s);
}

function isSkipLine(s: string) {
  const t = s.trim();
  if (!t) return true;
  if (SKIP.test(t)) return true;
  if (/^(итого|total|сумма|grand total|amount in words)/i.test(t)) return true;
  return false;
}

export function rowsFromTable(table: string[][]): PackRow[] {
  if (!table.length) return [];
  let start = 0;
  let nameI = 0;
  let qtyI = -1;
  let priceI = -1;
  const scan = Math.min(table.length, 12);
  for (let i = 0; i < scan; i += 1) {
    const head = table[i].map((c) => c.toLowerCase());
    const n = headerIndex(head, HEADER.name);
    const q = headerIndex(head, HEADER.qty);
    const u = headerIndex(head, HEADER.unit);
    const p = headerIndex(head, HEADER.price);
    if (n >= 0 || q >= 0 || p >= 0 || u >= 0) {
      nameI = n >= 0 ? n : 0;
      qtyI = q;
      priceI = u >= 0 ? u : p;
      start = i + 1;
      break;
    }
  }
  if (start === 0) {
    const sample = table.slice(0, 8);
    const width = Math.max(...sample.map((r) => r.length), 1);
    const numeric = Array.from({ length: width }, (_, c) =>
      sample.filter((r) => r[c] && looksNumeric(r[c])).length,
    );
    qtyI = numeric.findIndex((n, c) => n >= 3 && c > 0);
    const afterQty = numeric.findIndex((n, c) => n >= 3 && c > Math.max(qtyI, 0));
    priceI = afterQty;
    nameI = 0;
  }
  const rows: PackRow[] = [];
  for (const raw of table.slice(start)) {
    const name = cleanName((raw[nameI] || raw[0] || "").replace(/\s+/g, " "));
    if (!hasLetter(name) || isSkipLine(name) || name.length < 2) continue;
    const qty = qtyI >= 0 ? String(raw[qtyI] || "").trim() : "";
    const price = priceI >= 0 ? String(raw[priceI] || "").trim() : "";
    rows.push({
      name,
      qty: qty && parseMoney(qty) != null ? String(parseMoney(qty)) : qty,
      price: price && parseMoney(price) != null ? String(parseMoney(price)) : price,
    });
  }
  return dedupe(rows);
}

export function parseDelimited(text: string): PackRow[] {
  return rowsFromTable(parseCsvTable(text));
}

function tokenize(line: string) {
  const wide = line.split(/\s{2,}|\t+/).map((t) => t.trim()).filter(Boolean);
  if (wide.length >= 3) return wide;
  return line.split(/\s+/).filter(Boolean);
}

function stripQtyToken(tok: string) {
  const m = tok.match(/^(\d+(?:[.,]\d+)?)(?:pcs|pc|шт\.?|кг|kg|ctn|box|箱|件)?$/i);
  if (!m) return null;
  return parseMoney(m[1]) != null ? String(parseMoney(m[1])) : m[1];
}

export function parseInvoiceText(text: string): PackRow[] {
  const csvLike = (text.match(/[;\t]/g) || []).length >= 4 || (text.match(/,/g) || []).length >= 8;
  if (csvLike) {
    const fromCsv = parseDelimited(text);
    if (fromCsv.length >= 2) return fromCsv;
  }
  const lines = text
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const rows: PackRow[] = [];
  for (const line of lines) {
    if (isSkipLine(line)) {
      if (rows.length && /^(итого|total|сумма|grand total)/i.test(line)) break;
      continue;
    }
    const tokens = tokenize(line);
    const trailing: string[] = [];
    let cut = tokens.length - 1;
    while (cut >= 0 && trailing.length < 3) {
      const tok = tokens[cut];
      const q = stripQtyToken(tok);
      const money = q ?? (parseMoney(tok) != null ? String(parseMoney(tok)) : null);
      if (money == null) break;
      trailing.unshift(money);
      cut -= 1;
    }
    const name = cleanName(tokens.slice(0, cut + 1).join(" "));
    if (!trailing.length) {
      if (rows.length && hasLetter(line) && line.length > 3) {
        rows[rows.length - 1].name = `${rows[rows.length - 1].name} ${cleanName(line)}`.trim();
      }
      continue;
    }
    if (!hasLetter(name) || name.length < 2) continue;
    const qty = trailing[0];
    const price = trailing.length >= 3 ? trailing[1] : trailing.length === 2 ? trailing[1] : "";
    rows.push({ name, qty, price });
  }
  return dedupe(rows);
}

function dedupe(rows: PackRow[]) {
  const seen = new Set<string>();
  const out: PackRow[] = [];
  for (const row of rows) {
    const key = `${row.name.toLowerCase()}|${row.qty || ""}|${row.price || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function linesFromPdfItems(items: { str: string; x: number; y: number }[]) {
  const buckets = new Map<number, { x: number; str: string }[]>();
  for (const it of items) {
    const s = it.str.replace(/\s+/g, " ").trim();
    if (!s) continue;
    const y = Math.round(it.y / 3) * 3;
    const row = buckets.get(y) || [];
    row.push({ x: it.x, str: s });
    buckets.set(y, row);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, cells]) => cells.sort((a, b) => a.x - b.x).map((c) => c.str).join("  "));
}
