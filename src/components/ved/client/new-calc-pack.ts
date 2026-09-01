import type { FormItem, TariffOption } from "./types";
import { maxPositionsForTariffCode } from "./types";

export type PackId = "one" | "m20" | "m100";
export type PackMode = "single" | "multi";

export const MIN_PACK = 2;

export type PackChrome = {
  id: PackId;
  liveCode: "EXPRESS" | "STANDARD" | "PRO";
  name: string;
  tag: string;
  featured?: boolean;
  summary: string;
  includes: string[];
  priceRub: number;
  max: number;
};

const FALLBACK_PRICE: Record<PackChrome["liveCode"], number> = {
  EXPRESS: 990,
  STANDARD: 2990,
  PRO: 5990,
};

export function packIdForLiveCode(code: string): PackId {
  if (code === "PRO") return "m100";
  if (code === "STANDARD") return "m20";
  return "one";
}

export function liveCodeForPack(id: PackId): PackChrome["liveCode"] {
  if (id === "m100") return "PRO";
  if (id === "m20") return "STANDARD";
  return "EXPRESS";
}

export function namedItemCount(items: FormItem[]): number {
  return items.filter((it) => it.name.trim()).length;
}

export function fmtRub(n: number): string {
  return n.toLocaleString("ru-RU");
}

/** Live D27: no freemium — always TariffPlan.priceRub (C29c). */
export function liveWizardStepLabels(): readonly ["Товар", "Оплата", "Код"] {
  return ["Товар", "Оплата", "Код"] as const;
}

export function resolvePackChrome(
  id: PackId,
  tariffs: TariffOption[],
): PackChrome {
  const liveCode = liveCodeForPack(id);
  const hit = tariffs.find((t) => t.code === liveCode);
  const max = maxPositionsForTariffCode(liveCode);
  const priceRub = hit?.priceRub ?? FALLBACK_PRICE[liveCode];
  if (id === "one") {
    return {
      id,
      liveCode,
      name: "Старт",
      tag: "1 позиция",
      summary: `1 код ТН ВЭД ЕАЭС · ${fmtRub(priceRub)} ₽. Пошлина и НДС — отдельно.`,
      includes: ["1 код ТН ВЭД ЕАЭС", `Списание с баланса · ${fmtRub(priceRub)} ₽`],
      priceRub,
      max,
    };
  }
  if (id === "m20") {
    return {
      id,
      liveCode,
      name: "Стандарт",
      tag: `Мульти до ${max}`,
      featured: true,
      summary: `До ${max} позиций из файла. Один пакет — коды всем строкам · ${fmtRub(priceRub)} ₽.`,
      includes: ["Чтение CSV, Excel, PDF и фото", "Код ТН ВЭД каждой позиции"],
      priceRub,
      max,
    };
  }
  return {
    id,
    liveCode,
    name: "Профи",
    tag: `Мульти до ${max}`,
    summary: `До ${max} позиций. Для большого инвойса · ${fmtRub(priceRub)} ₽.`,
    includes: ["Чтение CSV, Excel, PDF и фото", "Код ТН ВЭД каждой позиции"],
    priceRub,
    max,
  };
}

export function allPackChrome(tariffs: TariffOption[]): PackChrome[] {
  return (["one", "m20", "m100"] as const).map((id) => resolvePackChrome(id, tariffs));
}

type PreviewRow = {
  rowIndex: number;
  name: string;
  description?: string;
  rowStatus: string;
  attrs?: FormItem["attrs"];
  hsCode?: string;
};

type PreviewResponse = {
  rowCount: number;
  rows: PreviewRow[];
  error?: string;
  kind?: "table" | "product" | "empty";
  notes?: string;
};

export function isPackSheetFile(name: string): boolean {
  return /\.(csv|xlsx|xls|pdf)$/i.test(name);
}

export function isPackImageFile(name: string, mime = ""): boolean {
  if (/^image\/(jpeg|jpg|png|webp|gif)$/i.test(mime)) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(name);
}

export async function previewPackFile(
  file: File,
  opts: { tariffCode: string; country?: string },
): Promise<{ items: FormItem[]; rowCount: number; kind?: PreviewResponse["kind"]; notes?: string }> {
  const image = isPackImageFile(file.name, file.type);
  if (!isPackSheetFile(file.name) && !image) {
    throw new Error("NEED_TABLE");
  }
  let body: Record<string, unknown>;
  if (image) {
    body = {
      imageBase64: await fileToBase64(file),
      mimeType: file.type || "image/jpeg",
      filename: file.name,
      tariffCode: opts.tariffCode,
      country: opts.country,
    };
  } else if (/\.pdf$/i.test(file.name)) {
    body = {
      pdfBase64: await fileToBase64(file),
      filename: file.name,
      tariffCode: opts.tariffCode,
      country: opts.country,
    };
  } else if (/\.xlsx$/i.test(file.name) || /\.xls$/i.test(file.name)) {
    body = {
      xlsxBase64: await fileToBase64(file),
      filename: file.name,
      tariffCode: opts.tariffCode,
      country: opts.country,
    };
  } else {
    body = { csv: await file.text(), tariffCode: opts.tariffCode, country: opts.country };
  }
  const res = await fetch("/api/v1/imports/products/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as PreviewResponse;
  if (!res.ok && !data.kind) throw new Error(data.error || `Preview ${res.status}`);
  const usable = (data.rows || []).filter((r) => r.rowStatus !== "PARSE_ERROR" && r.name.trim());
  const items: FormItem[] = usable.map((r) => ({
    name: r.name,
    qty: 1,
    unitPrice: 0,
    attrs: {
      ...r.attrs,
      composition: r.attrs?.composition || r.description || r.name,
      hsHint: r.hsCode || r.attrs?.hsHint,
    },
  }));
  return {
    items,
    rowCount: data.rowCount || items.length,
    kind: data.kind,
    notes: data.notes,
  };
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}
