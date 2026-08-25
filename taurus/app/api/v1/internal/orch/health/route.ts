/**
 * GET /api/v1/internal/orch/health — ServiceCall window + dep /health probes (D26).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrchestrationHealth } from "@/lib/ved/orch-health";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";

function authorizeInternal(req: NextRequest): boolean {
  const expected =
    process.env.INTERNAL_API_KEY ||
    process.env.CRON_SECRET ||
    process.env.NEXTAUTH_SECRET;
  const key =
    req.headers.get("x-internal-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(expected && key && key === expected);
}

export async function GET(req: NextRequest) {
  if (!authorizeInternal(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const windowMinutes = Number(req.nextUrl.searchParams.get("windowMinutes")) || 15;
  const proxied = await proxyDomainApi(
    `/v1/internal/orch/health?windowMinutes=${windowMinutes}`,
    {
      method: "GET",
      userId: "worker",
      role: "ADMIN",
    }
  );
  if (proxied) return forwardDomainResponse(proxied);

  const health = await getOrchestrationHealth(prisma, { windowMinutes });
  return NextResponse.json(health, { status: health.ok ? 200 : 503 });
}
