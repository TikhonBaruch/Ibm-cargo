/**
 * Trusted mediaUrl allowlist for server-side fetch / OCR handoff (SSRF harden).
 * Accept: `/uploads/ved/<safe>` (local upload) or absolute URLs under S3 base /
 * optional MEDIA_URL_ALLOWED_PREFIXES.
 */
import path from "path";
import { z } from "zod";
import type { EnvBag } from "../env-bag";

const LOCAL_UPLOAD_RE = /^\/uploads\/ved\/[A-Za-z0-9._-]+$/;

/** Safe relative upload path from POST /api/v1/uploads (non-S3). */
export function isLocalUploadMediaUrl(raw: string): boolean {
  return LOCAL_UPLOAD_RE.test(String(raw || "").trim());
}

/** Absolute path under public/uploads/ved for a local mediaUrl, or null. */
export function localUploadFsPath(mediaUrl: string): string | null {
  const url = String(mediaUrl || "").trim();
  if (!isLocalUploadMediaUrl(url)) return null;
  const name = url.slice("/uploads/ved/".length);
  return path.join(process.cwd(), "public", "uploads", "ved", name);
}

/**
 * Prefixes for absolute media URLs (trailing slash normalized).
 * S3: `${S3_ENDPOINT}/${S3_BUCKET}/` when both set.
 * Extra: comma-separated `MEDIA_URL_ALLOWED_PREFIXES` (tests / rare CDNs).
 */
export function mediaUrlAllowedPrefixes(env: EnvBag = process.env): string[] {
  const out: string[] = [];
  const endpoint = String(env.S3_ENDPOINT || "")
    .trim()
    .replace(/\/$/, "");
  const bucket = String(env.S3_BUCKET || "").trim();
  if (endpoint && bucket) {
    out.push(`${endpoint}/${bucket}/`);
  }
  const extra = String(env.MEDIA_URL_ALLOWED_PREFIXES || "");
  for (const part of extra.split(",")) {
    const p = part.trim();
    if (!p) continue;
    out.push(p.endsWith("/") ? p : `${p}/`);
  }
  return out;
}

export function isAllowedMediaUrl(
  raw: string | null | undefined,
  env: EnvBag = process.env
): boolean {
  if (raw == null) return false;
  const url = String(raw).trim();
  if (!url || url.length > 2000) return false;
  if (isLocalUploadMediaUrl(url)) return true;
  // Scheme-relative //evil.example — reject
  if (url.startsWith("//")) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;

  const prefixes = mediaUrlAllowedPrefixes(env);
  if (prefixes.length === 0) return false;

  const candidates = [parsed.href, url];
  return prefixes.some((prefix) => candidates.some((c) => c.startsWith(prefix)));
}

/** Zod field: optional mediaUrl that must be allowlisted when present. */
export const optionalAllowedMediaUrlSchema = z
  .string()
  .max(2000)
  .optional()
  .refine((v) => v == null || v === "" || isAllowedMediaUrl(v), {
    message: "mediaUrl must be an upload path (/uploads/ved/…) or configured S3 URL",
  });
