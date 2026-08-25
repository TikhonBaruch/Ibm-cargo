/**
 * Trusted mediaUrl allowlist (mirror of src/lib/ved/media-url.ts) for domain API.
 * Keep in sync when changing allowlist rules.
 */

const LOCAL_UPLOAD_RE = /^\/uploads\/ved\/[A-Za-z0-9._-]+$/;

export function isLocalUploadMediaUrl(raw) {
  return LOCAL_UPLOAD_RE.test(String(raw || "").trim());
}

export function mediaUrlAllowedPrefixes(env = process.env) {
  const out = [];
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

export function isAllowedMediaUrl(raw, env = process.env) {
  if (raw == null) return false;
  const url = String(raw).trim();
  if (!url || url.length > 2000) return false;
  if (isLocalUploadMediaUrl(url)) return true;
  if (url.startsWith("//")) return false;

  let parsed;
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
