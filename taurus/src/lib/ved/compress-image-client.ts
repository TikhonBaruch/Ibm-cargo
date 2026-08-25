/**
 * Browser-side image shrink before POST /api/v1/uploads (Vercel/S3 smoothness).
 * PDF / GIF / SVG / non-images pass through unchanged.
 */

export const UPLOAD_IMAGE_MAX_EDGE = 1600;
export const UPLOAD_IMAGE_MIN_BYTES = 350_000;
export const UPLOAD_IMAGE_QUALITY = 0.82;

export function shouldCompressImage(
  file: { type: string; size: number },
  minBytes = UPLOAD_IMAGE_MIN_BYTES
): boolean {
  const type = String(file.type || "").toLowerCase();
  if (!type.startsWith("image/")) return false;
  if (type === "image/gif" || type === "image/svg+xml") return false;
  return file.size > minBytes;
}

function targetSize(width: number, height: number, maxEdge: number): { w: number; h: number } {
  const edge = Math.max(width, height);
  if (edge <= maxEdge) return { w: width, h: height };
  const scale = maxEdge / edge;
  return { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) };
}

/** Pure helper for unit tests. */
export function compressTargetDimensions(
  width: number,
  height: number,
  maxEdge = UPLOAD_IMAGE_MAX_EDGE
): { w: number; h: number } {
  return targetSize(width, height, maxEdge);
}

/**
 * Downscale + JPEG recompress when over size threshold.
 * Safe no-op on server / unsupported types / canvas failure.
 */
export async function compressImageForUpload(
  file: File,
  opts: { maxEdge?: number; minBytes?: number; quality?: number } = {}
): Promise<File> {
  if (typeof window === "undefined") return file;
  const maxEdge = opts.maxEdge ?? UPLOAD_IMAGE_MAX_EDGE;
  const minBytes = opts.minBytes ?? UPLOAD_IMAGE_MIN_BYTES;
  const quality = opts.quality ?? UPLOAD_IMAGE_QUALITY;
  if (!shouldCompressImage(file, minBytes)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { w, h } = targetSize(bitmap.width, bitmap.height, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
    );
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "upload";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
