import type { OrderDoc, OrderDocKind } from "./types";
import { MAX_PACK } from "./batch-hs";

export const DOC_MAX_BYTES = 12 * 1024 * 1024;
export const DOC_MAX_COUNT = 20;
export const DOC_ACCEPT = "image/*,.pdf,.csv,.tsv,.txt,.xls,.xlsx,.doc,.docx,application/pdf,text/csv";

export function guessDocKind(name: string, mime: string): OrderDocKind {
  if (mime.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name)) return "photo";
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  return "other";
}

export function docLabel(doc: OrderDoc) {
  if (doc.packLines?.length) {
    const how =
      doc.packSource === "ocr" ? "OCR" :
      doc.packSource === "pdf" ? "PDF" :
      doc.packSource === "xlsx" ? "Excel" :
      doc.packSource === "csv" ? "таблица" : "файл";
    return `${how} · ${doc.packLines.length} поз.`;
  }
  if (doc.kind === "photo") return "Фото";
  if (/invoic|инвойс/i.test(doc.name)) return "Инвойс";
  if (/pack/i.test(doc.name)) return "Пэкинг-лист";
  if (/\.csv|\.tsv|\.xlsx|\.xls/i.test(doc.name)) return "Таблица";
  if (doc.kind === "pdf") return "PDF";
  return "Файл";
}

export function fmtBytes(n: number) {
  if (!n) return "";
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

export async function filesToDocs(
  files: File[],
  onStatus?: (message: string, pct?: number) => void,
): Promise<OrderDoc[]> {
  const { extractPackFromFile } = await import("./read-pack-file");
  const out: OrderDoc[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const mime = file.type || "application/octet-stream";
    const kind = guessDocKind(file.name, mime);
    const prefix = files.length > 1 ? `${i + 1}/${files.length}: ` : "";
    onStatus?.(`${prefix}Читаем ${file.name}…`, 4);
    let packLines: OrderDoc["packLines"];
    let packSource: OrderDoc["packSource"];
    let ocrText: string | undefined;
    try {
      const extracted = await extractPackFromFile(file, (msg, pct) => onStatus?.(`${prefix}${msg}`, pct));
      if (extracted.rows.length && kind !== "photo") {
        packLines = extracted.rows.slice(0, MAX_PACK);
        packSource = extracted.source;
      }
      ocrText = extracted.ocrText;
    } catch {
      packLines = undefined;
    }
    out.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      mime,
      size: file.size,
      kind,
      preview: kind === "photo" ? URL.createObjectURL(file) : undefined,
      packLines,
      packSource,
      ocrText,
    });
  }
  return out;
}

export function revokeDoc(doc: OrderDoc) {
  if (doc.preview?.startsWith("blob:")) URL.revokeObjectURL(doc.preview);
}

export function seedDoc(id: string, name: string, preview?: string): OrderDoc {
  const kind = guessDocKind(name, "");
  return {
    id,
    name,
    mime: kind === "pdf" ? "application/pdf" : kind === "photo" ? "image/jpeg" : "application/octet-stream",
    size: 0,
    kind,
    preview,
  };
}

/** Branded cover when the client did not attach a product photo. */
export const ORDER_PLACEHOLDER = "/lbm-bro/assets/order-placeholder.svg";

const LEGACY_MISSING = [
  "/lbm-bro/assets/product-laptop.jpg",
  "/lbm-bro/assets/ob-1-truck.jpg",
  "/lbm-bro/assets/ob-2-fleet.jpg",
  "/lbm-bro/assets/ob-2-docs.jpg",
  "/lbm-bro/assets/ob-3-cargo.jpg",
];

export function firstPhotoUrl(docs: OrderDoc[]) {
  return docs.find((d) => d.kind === "photo" && d.preview)?.preview;
}

export function isOrderPlaceholder(src?: string) {
  return !src || src === ORDER_PLACEHOLDER;
}

export function resolveOrderImage(src?: string | null) {
  if (!src || isOrderPlaceholder(src)) return ORDER_PLACEHOLDER;
  if (LEGACY_MISSING.includes(src)) return ORDER_PLACEHOLDER;
  return src;
}

/** Strip ephemeral or broken refs before persisting or displaying order cards. */
export function sanitizeOrderImage(src?: string | null) {
  const resolved = resolveOrderImage(src);
  if (resolved === ORDER_PLACEHOLDER) return ORDER_PLACEHOLDER;
  if (src?.startsWith("blob:")) return ORDER_PLACEHOLDER;
  return resolved;
}

export function orderCoverUrl(docs?: OrderDoc[] | null) {
  const photo = firstPhotoUrl(docs || []);
  if (!photo) return ORDER_PLACEHOLDER;
  if (photo.startsWith("blob:")) return photo;
  return resolveOrderImage(photo);
}

export type OrderCoverInput = {
  title?: string;
  desc?: string;
  hs?: string;
  img?: string | null;
};

/** Branded category cover when there is no uploaded product photo. */
export function pickOrderCover(order: OrderCoverInput) {
  if (order.img?.startsWith("blob:")) return order.img;
  const resolved = resolveOrderImage(order.img);
  if (!isOrderPlaceholder(resolved)) return resolved;

  const hs = (order.hs || "").replace(/\s/g, "").toLowerCase();
  const t = `${order.title || ""} ${order.desc || ""}`.toLowerCase();

  if (/пакет|\bpack\b/.test(t) || hs.startsWith("610910")) return "/lbm-bro/assets/cover-pack.svg";
  if (/носк|sock/.test(t) || hs.startsWith("6115")) return "/lbm-bro/assets/cover-socks.svg";
  if (/джинс|denim|брюк/.test(t) || /^6203/.test(hs)) return "/lbm-bro/assets/cover-jeans.svg";
  if (/ноутб|laptop|thinkpad|lenovo/.test(t) || hs.startsWith("8471")) return "/lbm-bro/assets/cover-laptop.svg";
  if (/ткан|хлоп|textile|fabric/.test(t) || hs.startsWith("5208")) return "/lbm-bro/assets/cover-fabric.svg";
  if (/авто|запчаст|filter|фильтр|оборуд/.test(t) || /^8708/.test(hs) || hs.startsWith("8421")) return "/lbm-bro/assets/cover-auto.svg";

  return ORDER_PLACEHOLDER;
}
