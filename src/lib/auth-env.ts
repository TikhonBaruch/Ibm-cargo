import { createHash } from "crypto";
import { ensureNextAuthUrl, isForeignIbmCargoOrigin } from "./site-url";

function absoluteOrigin(hostOrUrl: string): string {
  const t = hostOrUrl.trim().replace(/\/$/, "");
  if (!t) return "";
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return `https://${t}`;
}

/** Branch alias, then unique deployment host. Empty when not on Vercel. */
export function previewOrigin(env: NodeJS.ProcessEnv = process.env): string {
  for (const raw of [env.VERCEL_BRANCH_URL, env.VERCEL_URL]) {
    const host = (raw || "").trim();
    if (!host) continue;
    const origin = absoluteOrigin(host);
    if (origin && !isForeignIbmCargoOrigin(origin)) return origin;
  }
  return "";
}

/**
 * On Vercel Preview, ignore a Production NEXTAUTH_URL so cookies/CSRF match
 * the branch URL the user actually opens.
 */
export function ensureNextAuthUrlForRuntime(env: NodeJS.ProcessEnv = process.env): string {
  if ((env.VERCEL_ENV || "").trim() === "preview") {
    const origin = previewOrigin(env);
    if (origin) {
      env.NEXTAUTH_URL = origin;
      return origin;
    }
  }
  return ensureNextAuthUrl(env);
}

/**
 * next-auth v4 reads NEXTAUTH_SECRET. Vercel / Auth.js often set AUTH_SECRET only.
 * Preview without either still needs a secret or NextAuth renders "Server error".
 * Do not invent a secret when VERCEL_ENV=production.
 */
export function ensureAuthSecret(env: NodeJS.ProcessEnv = process.env): string {
  const existing = (env.NEXTAUTH_SECRET || env.AUTH_SECRET || "").trim();
  if (existing) {
    if (!(env.NEXTAUTH_SECRET || "").trim()) env.NEXTAUTH_SECRET = existing;
    return existing;
  }
  if ((env.VERCEL_ENV || "").trim() === "preview") {
    const seed = `ibm-cargo-preview:${env.VERCEL_GIT_COMMIT_SHA || ""}:${env.VERCEL_URL || ""}`;
    const generated = createHash("sha256").update(seed).digest("hex");
    env.NEXTAUTH_SECRET = generated;
    return generated;
  }
  if ((env.NODE_ENV || "development") !== "production") {
    const dev = "local-dev-secret-change-me-ibm-cargo";
    env.NEXTAUTH_SECRET = dev;
    return dev;
  }
  return "";
}

export function bootAuthEnv(env: NodeJS.ProcessEnv = process.env): { url: string; secret: string } {
  const url = ensureNextAuthUrlForRuntime(env);
  const secret = ensureAuthSecret(env);
  return { url, secret };
}
