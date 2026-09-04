import { previewPackFile, isPackImageFile } from "@/components/ved/client/new-calc-pack";
import { MAX_PACK } from "./batch-hs";
import { guessDocKind } from "./docs";
import type { OrderDoc } from "./types";

/**
 * Browser-only pack/OCR reader. Kept off the /client layout graph so pdfjs-dist
 * (needs DOMMatrix) is not evaluated by Turbopack during SSR of every lab page.
 */
export async function filesToDocs(
  files: File[],
  onStatus?: (message: string, pct?: number) => void,
): Promise<OrderDoc[]> {
  if (typeof window === "undefined") return [];
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
      if (isPackImageFile(file) || kind === "photo") {
        try {
          const { items } = await previewPackFile(file, { tariffCode: "PRO" });
          if (items.length) {
            packLines = items.slice(0, MAX_PACK).map((it) => ({
              name: it.name,
              qty: it.qty != null ? String(it.qty) : "",
              price: it.unitPrice != null ? String(it.unitPrice) : "",
            }));
            packSource = "ocr";
          }
        } catch {
          /* fall through to local reader */
        }
      }
      if (!packLines?.length) {
        const extracted = await extractPackFromFile(file, (msg, pct) =>
          onStatus?.(`${prefix}${msg}`, pct),
        );
        if (extracted.rows.length) {
          packLines = extracted.rows.slice(0, MAX_PACK);
          packSource = extracted.source;
        }
        ocrText = extracted.ocrText;
      }
    } catch {
      packLines = packLines || undefined;
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
