/**
 * OCR / docs-ingest. Envelope: contracts/d-ocr.ai.json
 * Synced with containers/ocr — text PDF + vision describe/reset (Qwen or DeepSeek by chainId).
 */
import http from "node:http";
import { extractText, getDocumentProxy } from "unpdf";
import { describeWithQwen, resetQwenSession, qwenVisionConfig } from "./qwen-session.js";
import { describeWithDeepseek, resetDeepseekSession, deepseekVisionConfig } from "./deepseek-session.js";
import { resolveVisionProvider } from "./vision-route.js";

const port = Number(process.env.PORT || 4700);
const EMBED_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS || 20000);

const HEADER_HINT =
  /наимен|naimenovan|name|товар|description|описание|qty|кол|cena|цена|price|бренд|brand|артикул|sku/i;

function splitTableLine(line) {
  const raw = String(line || "").trim();
  if (!raw) return [];
  const candidates = [
    raw.split(";").map((c) => c.trim()),
    raw.split("\t").map((c) => c.trim()),
    raw.split(",").map((c) => c.trim()),
  ];
  let best = candidates[0];
  for (const c of candidates) if (c.length > best.length) best = c;
  if (best.length >= 2) return best;
  const spaced = raw.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
  if (spaced.length >= 2) return spaced;
  return [raw];
}

function sheetTableFromText(text) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^page\s+\d+/i.test(l));
  if (!lines.length) return { headers: [], rows: [] };

  let headerIdx = lines.findIndex(
    (l) => HEADER_HINT.test(l) && splitTableLine(l).length >= 2
  );
  if (headerIdx < 0) {
    const productLines = lines.filter((l) => {
      if (/^(invoice|packing|total|итого|сумма|дата|date|№|n[oо]\.?)/i.test(l)) return false;
      if (/^\d+([.,]\d+)?\s*(usd|eur|rub|₽|\$)?$/i.test(l)) return false;
      return l.length >= 3;
    });
    const rows = productLines.slice(0, 200).map((l) => {
      const cells = splitTableLine(l);
      return cells.length >= 2 ? cells : [l];
    });
    const maxCols = Math.max(1, ...rows.map((r) => r.length));
    const headers = ["name", ...Array.from({ length: maxCols - 1 }, (_, i) => `col${i + 2}`)];
    if (maxCols >= 2 && rows.some((r) => /^\d+([.,]\d+)?$/.test(r[1] || ""))) headers[1] = "цена";
    if (maxCols >= 3 && rows.some((r) => /^\d+([.,]\d+)?$/.test(r[2] || ""))) headers[2] = "количество";
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

function attrsFromOcrText(text) {
  const t = String(text || "");
  const attrs = {};
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

function tableRowsToItems(table) {
  const headers = table.headers || [];
  const nameCol = headers.findIndex((h) => /наимен|name|товар/i.test(h));
  const col = nameCol >= 0 ? nameCol : 0;
  const priceCol = headers.findIndex((h) => /цена|price|unitprice/i.test(h));
  const qtyCol = headers.findIndex((h) => /кол|qty|количество/i.test(h));
  const descCol = headers.findIndex((h) => /опис|desc/i.test(h));
  return (table.rows || [])
    .map((cells) => {
      const name = String(cells[col] || "").trim();
      if (!name) return null;
      const unitPrice =
        priceCol >= 0 ? Number(String(cells[priceCol] || "").replace(",", ".")) : undefined;
      const qty = qtyCol >= 0 ? Number(String(cells[qtyCol] || "").replace(",", ".")) : undefined;
      return {
        name,
        description: descCol >= 0 ? String(cells[descCol] || "").trim() || undefined : undefined,
        qty: qty && qty > 0 ? qty : undefined,
        unitPrice: unitPrice != null && !Number.isNaN(unitPrice) ? unitPrice : undefined,
      };
    })
    .filter(Boolean);
}

async function pdfBytesFromBody(body) {
  if (body.pdfBase64) {
    return Buffer.from(String(body.pdfBase64), "base64");
  }
  if (body.imageBase64 && /pdf/i.test(body.mimeType || "")) {
    return Buffer.from(String(body.imageBase64), "base64");
  }
  const url = body.mediaUrl;
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function extractPdfText(bytes) {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : String(text || "");
  } catch {
    return "";
  }
}

async function visionExtract(body) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model =
    process.env.OCR_VISION_MODEL ||
    process.env.LLM_CLASSIFY_MODEL ||
    "gpt-4o-mini";
  const imageB64 = body.imageBase64 || body.pdfBase64;
  if (!imageB64) return null;
  const mime = body.mimeType || (body.pdfBase64 ? "application/pdf" : "image/jpeg");
  // Chat vision typically wants image/*; skip PDF binary via vision
  if (/pdf/i.test(mime)) return null;
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract product line items from this invoice/packing list as JSON: {"items":[{"name":"","description":"","qty":1,"unitPrice":0}],"attrs":{"brand":"","model":"","purpose":""}}. Hint: ${body.hint || ""}`,
              },
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${imageB64}` },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    return {
      engine: "ocr-vision-v1",
      text: JSON.stringify(parsed.items || []).slice(0, 2000),
      attrs: parsed.attrs || {},
      items: Array.isArray(parsed.items) ? parsed.items : [],
      confidence: 0.7,
      disclaimer: "Vision OCR (ocr-vision-v1). Verify line items with broker.",
    };
  } catch {
    return null;
  }
}

async function imageBytesFromBody(body) {
  if (body.imageBase64 && !/pdf/i.test(body.mimeType || "")) {
    return { b64: String(body.imageBase64), mime: body.mimeType || "image/jpeg" };
  }
  const url = body.mediaUrl;
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(EMBED_TIMEOUT_MS) });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type") || body.mimeType || "image/jpeg";
    if (/pdf/i.test(mime)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return { b64: buf.toString("base64"), mime: mime.split(";")[0] };
  } catch {
    return null;
  }
}

async function doDescribe(body) {
  const img = await imageBytesFromBody(body);
  if (!img) {
    const err = new Error("image or mediaUrl required");
    err.status = 400;
    throw err;
  }
  const provider = resolveVisionProvider(body);
  try {
    const opts = { imageB64: img.b64, mime: img.mime, hint: body.hint };
    if (provider === "deepseek") {
      return await describeWithDeepseek(opts);
    }
    return await describeWithQwen(opts);
  } finally {
    img.b64 = "";
  }
}

async function doReset(body = {}) {
  const provider = resolveVisionProvider(body);
  if (provider === "deepseek") {
    return resetDeepseekSession();
  }
  return resetQwenSession();
}

function stubExtract(body = {}) {
  const hint = String(body.hint || body.filename || "").trim();
  return {
    engine: "ocr-stub-v0",
    text: hint ? `Stub extract for: ${hint.slice(0, 120)}` : "Stub OCR — no document content.",
    attrs: hint ? { purpose: hint.slice(0, 80) } : {},
    items: [],
    confidence: 0.35,
    disclaimer: "Stub OCR (ocr-stub-v0). Provide PDF text layer or OPENAI_API_KEY for vision.",
  };
}

async function doExtract(body) {
  const bytes = await pdfBytesFromBody(body);
  if (bytes && bytes.length > 4) {
    const text = await extractPdfText(bytes);
    if (text.trim().length >= 3) {
      const attrs = attrsFromOcrText(text);
      const hint = String(body.hint || "").trim();
      if (hint && !attrs.purpose) attrs.purpose = hint.slice(0, 80);
      return {
        engine: "ocr-pdf-text-v1",
        text: text.slice(0, 4000),
        attrs,
        confidence: Object.keys(attrs).length ? 0.65 : 0.45,
        disclaimer: "Text-layer PDF extract (ocr-pdf-text-v1). Scanned pages need vision.",
      };
    }
  }

  const vision = await visionExtract(body);
  if (vision) return vision;

  return stubExtract(body);
}

async function doExtractTable(body) {
  const bytes = await pdfBytesFromBody(body);
  if (bytes && bytes.length > 4) {
    const text = await extractPdfText(bytes);
    if (text.trim().length >= 3) {
      const table = sheetTableFromText(text);
      const items = tableRowsToItems(table);
      if (items.length) {
        return {
          engine: "ocr-pdf-table-v1",
          text: text.slice(0, 4000),
          headers: table.headers,
          rows: table.rows,
          items,
          confidence: 0.7,
          disclaimer: "Text-layer PDF table (ocr-pdf-table-v1).",
        };
      }
    }
  }

  const vision = await visionExtract(body);
  if (vision?.items?.length) {
    return {
      ...vision,
      engine: vision.engine || "ocr-vision-v1",
      items: vision.items,
    };
  }

  return {
    engine: "ocr-stub-v0",
    text: "",
    headers: [],
    rows: [],
    items: [],
    confidence: 0.2,
    disclaimer: "No table extracted. Use CSV/XLSX or a text-layer PDF.",
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  res.setHeader("content-type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    const vision = resolveVisionProvider({});
    const visionReady =
      vision === "deepseek" ? deepseekVisionConfig().configured : qwenVisionConfig().configured;
    res.writeHead(200);
    res.end(
      JSON.stringify({
        ok: true,
        service: "ocr",
        engine: process.env.OPENAI_API_KEY || visionReady ? "ocr-pdf-text-v1+vision" : "ocr-pdf-text-v1",
        visionProvider: vision,
        qwenVision: qwenVisionConfig().configured,
        deepseekVision: deepseekVisionConfig().configured,
        chainId: String(process.env.AI_CHAIN_ID || process.env.LLM_CHAIN_ID || "2"),
      })
    );
    return;
  }

  if (
    req.method === "POST" &&
    (url.pathname === "/v1/extract" || url.pathname === "/v1/extract-table")
  ) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      body = {};
    }
    const out =
      url.pathname === "/v1/extract-table"
        ? await doExtractTable(body)
        : await doExtract(body);
    res.writeHead(200);
    res.end(JSON.stringify(out));
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/describe") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      body = {};
    }
    try {
      const out = await doDescribe(body);
      res.writeHead(200);
      res.end(JSON.stringify(out));
    } catch (e) {
      const status = e?.status && Number(e.status) >= 400 ? Number(e.status) : 500;
      res.writeHead(status);
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : "describe failed", engine: resolveVisionProvider(body) === "deepseek" ? "deepseek-vision-v1" : "qwen-vl-v1" }));
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/reset") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      body = {};
    }
    const out = await doReset(body);
    res.writeHead(out.ok || out.skipped ? 200 : 200);
    res.end(JSON.stringify(out));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, () => {
  console.log(`[ocr] listening on :${port}`);
});
