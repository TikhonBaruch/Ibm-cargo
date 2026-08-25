/**
 * Next.js 16 Proxy — Node.js runtime (replaces Edge middleware.ts).
 * UI RBAC redirects only. API auth + Docker BFF live in Route Handlers / src/lib/ved/proxy.ts.
 *
 * @see docs/knowledge/plan-vercel-services.md
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  isPublicAuthedPath,
  resolvePathAccess,
} from "@/lib/ved/access";
import {
  isSuperAdminLoginPath,
  isSuperAdminSurfacePath,
  SUPER_ADMIN_BASE,
} from "@/lib/ved/super-admin";
import { isDomainApiEnabled, mustStayOnNext } from "@/lib/ved/proxy-paths";
import { ensureNextAuthUrl } from "@/lib/site-url";

ensureNextAuthUrl();

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const method = req.method || "GET";

  // BFF: when domain API is on, rewrite /api/v1/* → /api/bff/* (except stay-on-next).
  if (
    isDomainApiEnabled() &&
    path.startsWith("/api/v1/") &&
    !mustStayOnNext(path)
  ) {
    const rest = path.slice("/api/v1/".length);
    const url = req.nextUrl.clone();
    url.pathname = `/api/bff/${rest}`;
    return NextResponse.rewrite(url);
  }

  // API: no Edge/Node gate here — handlers + BFF own auth (JSON 401).
  if (path.startsWith("/api/")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const role = token?.role as string | undefined;

  if (isPublicAuthedPath(path, method)) {
    return NextResponse.next();
  }

  if (isSuperAdminSurfacePath(path) && !isSuperAdminLoginPath(path) && !token) {
    return NextResponse.redirect(new URL(`${SUPER_ADMIN_BASE}/login`, req.url));
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const decision = resolvePathAccess(role, path);
  if (decision.type === "redirect") {
    return NextResponse.redirect(new URL(decision.to, req.url));
  }
  if (decision.type === "deny") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/2178737",
    "/2178737/:path*",
    "/cabinet/:path*",
    "/client",
    "/client/:path*",
    "/broker/:path*",
    "/manufacturer/:path*",
    "/login",
    "/api/v1/:path*",
  ],
};
