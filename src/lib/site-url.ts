/**
 * Absolute site origin for metadata / NextAuth.
 * Empty-string env on Vercel Preview must not reach `new URL("")` (next-auth parseUrl).
 *
 * `ibm-cargo.vercel.app` is a different Vercel project (static IBM Cargo), never this app.
 */
export const FOREIGN_IBM_CARGO_HOST = "ibm-cargo.vercel.app";

export function isForeignIbmCargoOrigin(raw: string): boolean {
  const t = (raw || "").trim();
  if (!t) return false;
  try {
    const u = new URL(t.includes("://") ? t : `https://${t}`);
    return u.hostname.toLowerCase() === FOREIGN_IBM_CARGO_HOST;
  } catch {
    return false;
  }
}

function normalizeOrigin(raw: string): string {
  const t = raw.trim().replace(/\/$/, "");
  if (!t) return "";
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return `https://${t}`;
}

export function resolveSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const candidates = [
    env.NEXTAUTH_URL,
    env.NEXT_PUBLIC_SITE_URL,
    env.VERCEL_BRANCH_URL ? `https://${env.VERCEL_BRANCH_URL}` : "",
    env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "",
    env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "",
  ];
  for (const raw of candidates) {
    const t = (raw || "").trim();
    if (!t) continue;
    const origin = normalizeOrigin(t);
    if (!origin || isForeignIbmCargoOrigin(origin)) continue;
    return origin;
  }
  return "http://localhost:3000";
}

/** Ensure NEXTAUTH_URL is a non-empty absolute URL before next-auth loads. */
export function ensureNextAuthUrl(env: NodeJS.ProcessEnv = process.env): string {
  const resolved = resolveSiteUrl(env);
  const current = (env.NEXTAUTH_URL || "").trim().replace(/\/$/, "");
  if (!current || isForeignIbmCargoOrigin(current)) {
    env.NEXTAUTH_URL = resolved;
  }
  return (env.NEXTAUTH_URL || resolved).trim().replace(/\/$/, "");
}
