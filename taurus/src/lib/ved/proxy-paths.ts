/**
 * Lightweight path/env helpers for root proxy.ts (no next-auth / prisma).
 */
export function domainApiBase(): string | null {
  const base = (process.env.DOMAIN_API_URL || process.env.API_SERVICE_URL || "").replace(
    /\/$/,
    ""
  );
  return base || null;
}

export function isDomainApiEnabled(): boolean {
  return process.env.USE_DOMAIN_API === "1" && Boolean(domainApiBase());
}

/** /api/v1/calculations/1 → /v1/calculations/1 */
export function stripApiV1Prefix(pathname: string): string {
  const p = pathname.split("?")[0] || pathname;
  if (p === "/api/v1" || p.startsWith("/api/v1/")) {
    const rest = p.slice("/api/v1".length);
    return `/v1${rest || ""}`;
  }
  if (p.startsWith("/v1/") || p === "/v1") return p;
  return `/v1/${p.replace(/^\//, "")}`;
}

/** Paths that must stay on Next even when USE_DOMAIN_API=1. */
export function mustStayOnNext(pathname: string): boolean {
  if (pathname.startsWith("/api/v1/auth/")) return true;
  if (pathname.startsWith("/api/v1/uploads")) return true;
  if (pathname.startsWith("/api/v1/imports/")) return true;
  if (pathname === "/api/v1/internal/jobs-tick") return true;
  return false;
}
