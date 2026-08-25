/**
 * Optional OCR extract (P2). Fail-open: never blocks create.
 * Contract: contracts/d-ocr.ai.json · services/ocr
 * SOURCE: taurus/src/lib/ved/ocr.ts — reference only.
 */
export type ProductAttrs = Record<string, unknown>;

export type OcrExtractResult = {
  engine?: string;
  text?: string;
  attrs?: ProductAttrs;
  confidence?: number;
  disclaimer?: string;
};

export async function extractWithOcr(opts: {
  mediaUrl?: string | null;
  mimeType?: string;
  filename?: string;
  hint?: string;
}): Promise<OcrExtractResult | null> {
  const base = (process.env.OCR_SERVICE_URL || "").replace(/\/$/, "");
  if (!base || !opts.mediaUrl) return null;
  try {
    const res = await fetch(`${base}/v1/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaUrl: opts.mediaUrl,
        mimeType: opts.mimeType,
        filename: opts.filename,
        hint: opts.hint,
      }),
      signal: AbortSignal.timeout(Number(process.env.OCR_TIMEOUT_MS || 5000)),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OcrExtractResult;
    return data;
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
  return { ...(fromOcr || {}), ...(existing || {}) };
}
