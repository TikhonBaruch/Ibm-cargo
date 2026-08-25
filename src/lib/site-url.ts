/**
 * Absolute site origin for metadata / NextAuth.
 * Empty-string env on Vercel Preview must not reach `new URL("")` (next-auth parseUrl).
 */
export function resolveSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const candidates = [
    env.NEXTAUTH_URL,
    env.NEXT_PUBLIC_SITE_URL,
    env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "",
    "https://ibm-cargo.vercel.app",
  ];
  for (const raw of candidates) {
    const t = (raw || "").trim();
    if (!t) continue;
    if (t.startsWith("http://") || t.startsWith("https://")) return t.replace(/\/$/, "");
    return `https://${t.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

/** Ensure NEXTAUTH_URL is a non-empty absolute URL before next-auth loads. */
export function ensureNextAuthUrl(env: NodeJS.ProcessEnv = process.env): string {
  const resolved = resolveSiteUrl(env);
  if (!(env.NEXTAUTH_URL || "").trim()) {
    env.NEXTAUTH_URL = resolved;
  }
  return (env.NEXTAUTH_URL || resolved).trim().replace(/\/$/, "");
}
