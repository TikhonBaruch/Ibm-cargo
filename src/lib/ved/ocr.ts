/**
 * Optional OCR extract (P2). Fail-open: never blocks create.
 * Contract: docs/contracts/d-ocr.ai.json · containers/ocr
 * C25: image/* via server-side fetch → imageBase64 for vision path.
 */
import { fetchMediaAsBase64 } from "./provider-mesh";
import { isAllowedMediaUrl, localUploadFsPath } from "./media-url";
import type { ProductAttrs } from "./product-description";
import { sanitizeProductAttrs } from "./product-description";

export type OcrExtractResult = {
  engine?: string;
  text?: string;
  attrs?: ProductAttrs;
  confidence?: number;
  disclaimer?: string;
};

function mimeFromMediaUrl(mediaUrl: string, mimeType?: string) {
  if (mimeType) return mimeType.split(";")[0].trim();
  const lower = mediaUrl.toLowerCase();
  if (/\.jpe?g(\?|$)/.test(lower)) return "image/jpeg";
  if (/\.png(\?|$)/.test(lower)) return "image/png";
  if (/\.webp(\?|$)/.test(lower)) return "image/webp";
  if (/\.pdf(\?|$)/.test(lower)) return "application/pdf";
  return "application/octet-stream";
}

function isImageMime(mime: string) {
  return mime.startsWith("image/");
}

export async function extractWithOcr(opts: {
  mediaUrl?: string | null;
  mimeType?: string;
  filename?: string;
  hint?: string;
}): Promise<OcrExtractResult | null> {
  const base = (process.env.OCR_SERVICE_URL || "").replace(/\/$/, "");
  if (!base || !opts.mediaUrl) return null;
  if (!isAllowedMediaUrl(opts.mediaUrl)) return null;

  const mime = mimeFromMediaUrl(opts.mediaUrl, opts.mimeType);
  const timeoutMs = Number(process.env.OCR_TIMEOUT_MS || 5000);

  let body: Record<string, unknown> = {
    mimeType: mime,
    filename: opts.filename,
    hint: opts.hint,
  };

  if (isImageMime(mime)) {
    const media = await fetchMediaAsBase64(opts.mediaUrl, timeoutMs);
    if (!media.ok || !media.b64) {
      body = { ...body, mediaUrl: opts.mediaUrl };
    } else {
      body = { ...body, imageBase64: media.b64, mimeType: media.mime || mime };
    }
  } else if (localUploadFsPath(opts.mediaUrl) || isImageMime(mime)) {
    body = { ...body, mediaUrl: opts.mediaUrl };
  } else {
    body = { ...body, mediaUrl: opts.mediaUrl };
  }

  try {
    const res = await fetch(`${base}/v1/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OcrExtractResult;
    return {
      ...data,
      attrs: sanitizeProductAttrs(data.attrs) || undefined,
    };
  } catch {
    return null;
  }
}

/** Merge OCR attrs under existing client attrs (client wins). */
export function mergeAttrs(
  existing?: ProductAttrs | null,
  fromOcr?: ProductAttrs | null
): ProductAttrs | undefined {
  if (!fromOcr && !existing) return undefined;
  return sanitizeProductAttrs({ ...(fromOcr || {}), ...(existing || {}) }) || undefined;
}
