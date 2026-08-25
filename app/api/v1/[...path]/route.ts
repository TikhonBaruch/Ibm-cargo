import { NextRequest, NextResponse } from "next/server";
import {
  handleBffProxy,
  isDomainApiEnabled,
  mustStayOnNext,
  stripApiV1Prefix,
} from "@/lib/ved/proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ path?: string[] }> };

/**
 * Catch-all BFF for /api/v1/* segments not handled by a more specific route.
 * When USE_DOMAIN_API=1, root `proxy.ts` may rewrite all /api/v1/* here via /api/bff/*.
 */
async function handle(req: NextRequest, ctx: Ctx) {
  const { path: segments = [] } = await ctx.params;
  const suffix = segments.join("/");
  const apiPath = `/api/v1/${suffix}`.replace(/\/$/, "") || "/api/v1";

  if (mustStayOnNext(apiPath)) {
    return NextResponse.json(
      {
        error: "Handled by a dedicated Next route",
        path: apiPath,
        hint: "This catch-all should not receive stay-on-next paths",
      },
      { status: 404 }
    );
  }

  if (!isDomainApiEnabled()) {
    return NextResponse.json(
      {
        error: "Not found",
        hint: "No dedicated Next route; enable USE_DOMAIN_API=1 + DOMAIN_API_URL for BFF proxy",
      },
      { status: 404 }
    );
  }

  const domainPath = stripApiV1Prefix(apiPath);
  return handleBffProxy(req, domainPath);
}

export async function GET(req: NextRequest, ctx: Ctx) {
  return handle(req, ctx);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return handle(req, ctx);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return handle(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handle(req, ctx);
}
export async function HEAD(req: NextRequest, ctx: Ctx) {
  return handle(req, ctx);
}
export async function OPTIONS(req: NextRequest, ctx: Ctx) {
  return handle(req, ctx);
}
