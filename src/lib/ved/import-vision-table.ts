/**
 * Invoice / packing-list photo → table rows (C37 / OCR-A).
 * DeepSeek vision in-process (parallel to product describe); fail-open → null.
 */
import type { EnvBag } from "../env-bag";
import { visionDescribeTimeoutMs } from "./ai-drain-retry";
import { deepseekVisionConfigured } from "./openai-compat";
import type { SheetTable } from "./pdf-table";

export type VisionImportItem = {
  name: string;
  description?: string;
  qty?: number;
  unitPrice?: number;
};

export type VisionTableExtract = {
  engine: string;
  kind: "table" | "product" | "empty";
  items: VisionImportItem[];
  description?: string;
};

const EXTRACT_PROMPT = [
  "Это инвойс, packing list или фото таблицы товарных позиций для классификации ТН ВЭД.",
  'Ответь JSON: {"kind":"table"|"product","items":[{"name":"","description":"","qty":1,"unitPrice":0}],"description":""}.',
  "kind=table если видна таблица или список из двух и более товарных позиций.",
  "kind=product если одно изделие без таблицы — тогда items 0–1.",
  "name = тип/наименование позиции; description = состав или уточнение (не назначение первым).",
  "qty и unitPrice — только если явно видны на документе, иначе опусти.",
  "Не выдумывай коды ТН ВЭД. Пустые имена не включай.",
].join(" ");

function parseJsonObject(raw: string): Record<string, unknown> {
  const t = String(raw || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    const v = JSON.parse(t) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function asItems(raw: unknown): VisionImportItem[] {
  if (!Array.isArray(raw)) return [];
  const out: VisionImportItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const name = String(rec.name || rec.title || rec.наименование || "").trim();
    if (!name) continue;
    const qty = Number(rec.qty ?? rec.quantity);
    const unitPrice = Number(rec.unitPrice ?? rec.price);
    out.push({
      name: name.slice(0, 240),
      description:
        rec.description != null ? String(rec.description).trim().slice(0, 500) : undefined,
      qty: Number.isFinite(qty) && qty > 0 ? qty : undefined,
      unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : undefined,
    });
  }
  return out;
}

export function visionImportConfigured(env: EnvBag = process.env): boolean {
  return deepseekVisionConfigured(env);
}

export function isImageImportFilename(name: string, mime = ""): boolean {
  if (/^image\/(jpeg|jpg|png|webp|gif)$/i.test(mime)) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(String(name || ""));
}

export function sheetTableFromVisionItems(items: VisionImportItem[]): SheetTable {
  return {
    headers: ["name", "description", "qty", "цена"],
    rows: items.map((it) => [
      it.name,
      it.description || "",
      it.qty != null ? String(it.qty) : "",
      it.unitPrice != null ? String(it.unitPrice) : "",
    ]),
  };
}

/** DeepSeek vision table extract from raw image bytes. */
export async function extractTableFromVisionImage(
  opts: { imageBase64: string; mimeType?: string; hint?: string },
  env: EnvBag = process.env
): Promise<VisionTableExtract | null> {
  if (!deepseekVisionConfigured(env)) return null;
  const b64 = String(opts.imageBase64 || "").replace(/^data:[^;]+;base64,/, "").trim();
  if (b64.length < 32) return null;
  const mime = String(opts.mimeType || "image/jpeg").split(";")[0] || "image/jpeg";
  if (/pdf/i.test(mime)) return null;

  const key = String(env.DEEPSEEK_API_KEY || "").trim();
  const base = String(env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const model = String(env.DEEPSEEK_VISION_MODEL || "deepseek-v4-flash-vision-exp").trim();
  const timeoutMs = visionDescribeTimeoutMs(env);

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
                text: `${EXTRACT_PROMPT} Hint: ${opts.hint || ""}`.trim(),
              },
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${b64}` },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = String(data.choices?.[0]?.message?.content || "").trim();
    const parsed = parseJsonObject(raw);
    const items = asItems(parsed.items);
    const kindRaw = String(parsed.kind || "").toLowerCase();
    const kind: VisionTableExtract["kind"] =
      kindRaw === "product" ? "product" : items.length >= 2 ? "table" : items.length ? "product" : "empty";
    if (!items.length) {
      return {
        engine: "deepseek-vision-table-v1",
        kind: "empty",
        items: [],
        description: String(parsed.description || "").trim() || undefined,
      };
    }
    return {
      engine: "deepseek-vision-table-v1",
      kind,
      items,
      description: String(parsed.description || "").trim() || undefined,
    };
  } catch {
    return null;
  }
}
