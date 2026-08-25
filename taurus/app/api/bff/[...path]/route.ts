import { NextRequest, NextResponse } from "next/server";
import { handleBffProxy, isDomainApiEnabled } from "@/lib/ved/proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ path?: string[] }> };

/**
 * Rewrite target when USE_DOMAIN_API=1 (see root proxy.ts).
 * URL: /api/bff/<rest>  →  domain /v1/<rest>
 */
async function handle(req: NextRequest, ctx: Ctx) {
  if (!isDomainApiEnabled()) {
    return NextResponse.json(
      { error: "Domain API proxy disabled" },
      { status: 503 }
    );
  }
  const { path: segments = [] } = await ctx.params;
  const domainPath = `/v1/${segments.join("/")}`.replace(/\/$/, "") || "/v1";
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
