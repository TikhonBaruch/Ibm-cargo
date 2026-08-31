/**
 * Preview Deployment Protection bypass for smoke/probe scripts (C32b).
 *
 * Ops: Vercel project → Settings → Deployment Protection →
 * Protection Bypass for Automation → secret.
 * Pass via env (never commit):
 *   VERCEL_AUTOMATION_BYPASS_SECRET=<secret>
 *   # alias:
 *   VERCEL_PROTECTION_BYPASS=<secret>
 *
 * Docs: https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
 *
 * Side-effect: wraps global fetch to add x-vercel-protection-bypass when secret is set.
 */
const secret =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ||
  process.env.VERCEL_PROTECTION_BYPASS?.trim() ||
  "";

if (secret && !globalThis.__lbmVercelBypassInstalled) {
  globalThis.__lbmVercelBypassInstalled = true;
  const orig = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init = {}) => {
    const headers = new Headers(init.headers ?? undefined);
    if (!headers.has("x-vercel-protection-bypass")) {
      headers.set("x-vercel-protection-bypass", secret);
      if (!headers.has("x-vercel-set-bypass-cookie")) {
        headers.set("x-vercel-set-bypass-cookie", "true");
      }
    }
    return orig(input, { ...init, headers });
  };
}

export const vercelBypassEnabled = Boolean(secret);
