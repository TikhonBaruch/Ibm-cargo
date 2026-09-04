/**
 * OCR-A: invoice / packing-list photo → SheetTable.
 * Does not use describeForChain (SKU prompt). Mesh table-extract or OCR extract-table.
 */
import { visionDescribeTimeoutMs } from "./ai-drain-retry";
import {
  aiChainMeta,
  callServiceJson,
  ocrServiceBaseUrl,
  resolveAiChainId,
  visionConfiguredForChain,
  type AiChainId,
} from "./chains";
import type { EnvBag } from "../env-bag";
import { isAllowedMediaUrl } from "./media-url";
import type { SheetTable } from "./pdf-table";
import {
  extractTableWithProviderDeepseek,
  extractTableWithProviderQwen,
  fetchMediaAsBase64,
} from "./provider-mesh";

export type InvoiceVisionItem = {
  name: string;
  description?: string;
  qty?: string;
  unitPrice?: string;
};

export type InvoiceVisionExtract = {
  table: SheetTable;
  engine?: string;
  attempted: true;
  error?: string;
};

export function importPreviewAllowsEmptyRows(kind: "sheet" | "image"): boolean {
  return kind === "image";
}

export function normalizeImageBase64(raw: string): string {
  const s = String(raw || "").trim();
  const m = s.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,([\s\S]+)$/i);
  return (m ? m[1]! : s).replace(/\s+/g, "");
}

export function normalizeImageMime(raw?: string, filename?: string): string | null {
  const mime = String(raw || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (mime === "image/jpg" || mime === "image/jpeg") return "image/jpeg";
  if (mime === "image/png" || mime === "image/webp") return mime;
  if (mime === "image/heic" || mime === "image/heif") return mime;
  const name = String(filename || "");
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.webp$/i.test(name)) return "image/webp";
  if (/\.(jpe?g)$/i.test(name)) return "image/jpeg";
  if (/\.(heic|heif)$/i.test(name)) return "image/heic";
  return mime.startsWith("image/") ? mime : null;
}

function stripFence(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function cell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

function itemFromUnknown(raw: unknown): InvoiceVisionItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = cell(o.name || o.title || o.наименование || o.товар || o.description);
  if (!name) return null;
  const description = cell(o.description || o.описание);
  return {
    name: name.slice(0, 240),
    description: description && description !== name ? description.slice(0, 500) : undefined,
    qty: cell(o.qty || o.quantity || o.кол) || undefined,
    unitPrice: cell(o.unitPrice || o.price || o.цена) || undefined,
  };
}

export function invoiceItemsFromVisionJson(parsed: unknown): InvoiceVisionItem[] {
  if (Array.isArray(parsed)) {
    return parsed.map(itemFromUnknown).filter((x): x is InvoiceVisionItem => Boolean(x));
  }
  if (!parsed || typeof parsed !== "object") return [];
  const o = parsed as Record<string, unknown>;
  const list = Array.isArray(o.items) ? o.items : Array.isArray(o.rows) ? o.rows : [];
  return list.map(itemFromUnknown).filter((x): x is InvoiceVisionItem => Boolean(x));
}

export function parseInvoiceVisionJson(raw: string): InvoiceVisionItem[] {
  const text = stripFence(raw);
  if (!text) return [];
  const tryParse = (s: string): unknown | null => {
    try {
      return JSON.parse(s) as unknown;
    } catch {
      return null;
    }
  };
  let parsed = tryParse(text);
  if (parsed == null) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) parsed = tryParse(text.slice(start, end + 1));
  }
  if (parsed == null) {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start >= 0 && end > start) parsed = tryParse(text.slice(start, end + 1));
  }
  if (parsed == null) return [];
  return invoiceItemsFromVisionJson(parsed);
}

export function sheetTableFromInvoiceItems(items: InvoiceVisionItem[]): SheetTable {
  return {
    headers: ["name", "description", "qty", "цена"],
    rows: items.map((it) => [
      it.name,
      it.description || "",
      it.qty || "",
      it.unitPrice || "",
    ]),
  };
}

async function inlineImageFromOpts(
  opts: { imageBase64?: string; mimeType?: string; mediaUrl?: string; filename?: string },
  env: EnvBag
): Promise<{ b64: string; mime: string } | null> {
  if (opts.imageBase64) {
    const b64 = normalizeImageBase64(opts.imageBase64);
    const mime = normalizeImageMime(opts.mimeType, opts.filename) || "image/jpeg";
    if (!b64 || b64.length < 32) return null;
    return { b64, mime };
  }
  const mediaUrl = String(opts.mediaUrl || "").trim();
  if (!mediaUrl || !isAllowedMediaUrl(mediaUrl, env)) return null;
  const media = await fetchMediaAsBase64(mediaUrl, visionDescribeTimeoutMs(env), env);
  if (!media.ok || !media.b64 || !media.mime) return null;
  return { b64: media.b64, mime: media.mime };
}

function tableFromOcrPayload(data: Record<string, unknown>): SheetTable | null {
  const headers = Array.isArray(data.headers) ? data.headers.map((h) => String(h)) : [];
  const rows = Array.isArray(data.rows)
    ? data.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "")) : []))
    : [];
  if (headers.length && rows.length) return { headers, rows };
  const items = invoiceItemsFromVisionJson(data);
  if (items.length) return sheetTableFromInvoiceItems(items);
  return null;
}

export async function extractInvoiceTableForChain(
  opts: {
    imageBase64?: string;
    mimeType?: string;
    mediaUrl?: string;
    filename?: string;
    hint?: string;
  },
  env: EnvBag = process.env,
  chainId: AiChainId = resolveAiChainId(env)
): Promise<InvoiceVisionExtract | null> {
  if (!visionConfiguredForChain(chainId, env)) return null;
  const image = await inlineImageFromOpts(opts, env);
  if (!image) return null;

  const ocrUrl = ocrServiceBaseUrl(env);
  if (ocrUrl) {
    try {
      const out = await callServiceJson(
        `${ocrUrl}/v1/extract-table`,
        {
          imageBase64: image.b64,
          mimeType: image.mime,
          filename: opts.filename,
          hint: opts.hint,
        },
        visionDescribeTimeoutMs(env)
      );
      const table = tableFromOcrPayload(out.data);
      return {
        table: table || { headers: ["name", "description", "qty", "цена"], rows: [] },
        engine: out.data.engine != null ? String(out.data.engine) : "ocr-vision-v1",
        attempted: true,
        error: table ? undefined : String(out.data.error || "ocr table empty"),
      };
    } catch (e) {
      return {
        table: { headers: ["name", "description", "qty", "цена"], rows: [] },
        attempted: true,
        error: e instanceof Error ? e.message : "ocr extract-table failed",
      };
    }
  }

  const vision = aiChainMeta(chainId).vision;
  const mesh =
    vision === "deepseek"
      ? await extractTableWithProviderDeepseek(image, { hint: opts.hint }, env)
      : await extractTableWithProviderQwen(image, { hint: opts.hint }, env);

  if (!mesh.ok) {
    return {
      table: { headers: ["name", "description", "qty", "цена"], rows: [] },
      engine: mesh.engine,
      attempted: true,
      error: mesh.error,
    };
  }
  const items = parseInvoiceVisionJson(mesh.content);
  return {
    table: sheetTableFromInvoiceItems(items),
    engine: mesh.engine,
    attempted: true,
  };
}
