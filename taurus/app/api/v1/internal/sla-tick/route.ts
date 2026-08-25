import { NextRequest, NextResponse } from "next/server";
import { runSlaTick } from "@/lib/ved/calculations";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";

function authorizeInternal(req: NextRequest): boolean {
  const expected =
    process.env.INTERNAL_API_KEY ||
    process.env.CRON_SECRET ||
    process.env.NEXTAUTH_SECRET;
  const key =
    req.headers.get("x-internal-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    req.nextUrl.searchParams.get("key");
  return Boolean(expected && key && key === expected);
}

/**
 * Worker / Vercel cron SLA tick. Auth: INTERNAL_API_KEY, CRON_SECRET, or NEXTAUTH_SECRET.
 * Vercel Cron sends GET with Authorization: Bearer <CRON_SECRET>.
 */
async function handle(req: NextRequest) {
  if (!authorizeInternal(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const proxied = await proxyDomainApi("/v1/internal/sla-tick", {
    method: "POST",
    userId: "worker",
    role: "ADMIN",
    body: {},
  });
  if (proxied) return forwardDomainResponse(proxied);

  const result = await runSlaTick({ actorUserId: "worker" });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
