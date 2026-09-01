/**
 * Invoice / product-photo vision for import preview (OCR-A).
 * In-process Qwen/DeepSeek — no OCR_SERVICE_URL required (Vercel).
 */
import type { EnvBag } from "../env-bag";
import { resolveAiChainId } from "./chains/registry";
import { deepseekVisionConfigured, qwenVisionConfigured } from "./openai-compat";
import { visionDescribeTimeoutMs } from "./ai-drain-retry";
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
  "Это инвойс, packing list или фото товара для классификации ТН ВЭД.",
  'Ответь JSON: {"kind":"table"|"product","items":[{"name":"","description":"","qty":1,"unitPrice":0}],"description":""}.',
  "kind=table если видна таблица или список из двух и более товарных позиций.",
  "kind=product если это одно изделие, этикетка или фото без таблицы — тогда items 0–1 и description по-русски.",
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
      description: rec.description != null ? String(rec.description).trim().slice(0, 500) : undefined,
      qty: Number.isFinite(qty) && qty > 0 ? qty : undefined,
      unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : undefined,
    });
  }
  return out;
}

export function visionImportConfigured(env: EnvBag = process.env): boolean {
  return qwenVisionConfigured(env) || deepseekVisionConfigured(env);
}

export function isImageFilename(name: string, mime = ""): boolean {
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

function providerOrder(env: EnvBag): Array<"deepseek" | "qwen"> {
  const chain = resolveAiChainId(env);
  const ds = deepseekVisionConfigured(env);
  const qw = qwenVisionConfigured(env);
  if (chain === 3) {
    return [ds ? "deepseek" : null, qw ? "qwen" : null].filter(Boolean) as Array<"deepseek" | "qwen">;
  }
  return [qw ? "qwen" : null, ds ? "deepseek" : null].filter(Boolean) as Array<"deepseek" | "qwen">;
}

async function visionChatJson(
  provider: "deepseek" | "qwen",
  opts: { imageBase64: string; mimeType: string; hint?: string },
  env: EnvBag
): Promise<{ engine: string; parsed: Record<string, unknown> } | null> {
  const key =
    provider === "deepseek"
      ? String(env.DEEPSEEK_API_KEY || "").trim()
      : String(env.QWEN_API_KEY || "").trim();
  if (!key) return null;
  const base = (
    provider === "deepseek"
      ? String(env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1")
      : String(env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1")
  ).replace(/\/$/, "");
  const model =
    provider === "deepseek"
      ? String(env.DEEPSEEK_VISION_MODEL || "deepseek-v4-flash-vision-exp").trim()
      : String(env.QWEN_VISION_MODEL || "qwen-vl-plus").trim();
  const engine = provider === "deepseek" ? "deepseek-vision-v1" : "qwen-vl-v1";
  const timeoutMs = visionDescribeTimeoutMs(env);
  const mime = opts.mimeType || "image/jpeg";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `${EXTRACT_PROMPT} Hint: ${opts.hint || ""}`.trim() },
            {
              type: "image_url",
              image_url: { url: `data:${mime};base64,${opts.imageBase64}` },
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
  return { engine, parsed: parseJsonObject(data.choices?.[0]?.message?.content || "") };
}

export async function extractTableFromVisionImage(
  opts: { imageBase64: string; mimeType?: string; hint?: string },
  env: EnvBag = process.env
): Promise<VisionTableExtract | null> {
  const b64 = String(opts.imageBase64 || "").trim();
  if (!b64 || !visionImportConfigured(env)) return null;
  const mime = String(opts.mimeType || "image/jpeg").split(";")[0].trim() || "image/jpeg";
  if (/pdf/i.test(mime)) return null;

  for (const provider of providerOrder(env)) {
    try {
      const hit = await visionChatJson(provider, { imageBase64: b64, mimeType: mime, hint: opts.hint }, env);
      if (!hit) continue;
      const items = asItems(hit.parsed.items);
      const description = String(hit.parsed.description || "").trim().slice(0, 800) || undefined;
      const kindRaw = String(hit.parsed.kind || "").toLowerCase();
      const kind: VisionTableExtract["kind"] =
        kindRaw === "product" || items.length < 2 ? (items.length ? "product" : description ? "product" : "empty") : "table";
      return { engine: hit.engine, kind, items, description };
    } catch {
      continue;
    }
  }
  return null;
}
