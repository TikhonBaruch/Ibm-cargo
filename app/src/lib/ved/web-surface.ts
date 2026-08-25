/**
 * C5 surface flag (D22 / web-slim.md).
 * full = monolith cabinets on web (default, Vercel today).
 * slim = signal only until cutover ADR — do not strip routes yet.
 */
export type WebSurface = "full" | "slim";

export function getWebSurface(env: NodeJS.ProcessEnv = process.env): WebSurface {
  const raw = (env.WEB_SURFACE || env.APP_SURFACE || "full").toLowerCase();
  return raw === "slim" ? "slim" : "full";
}

/** Cabinets still served from root Next until slim cutover completes. */
export function cabinetsOnWebMonolith(env: NodeJS.ProcessEnv = process.env): boolean {
  return getWebSurface(env) === "full";
}
