/**
 * Drain ServiceOutbox → notify service or inline Resend; mark DELIVERED / FAILED (D26 / F17).
 * Without RESEND_API_KEY / NOTIFY_SERVICE_URL do **not** fake DELIVERED.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { drainServiceOutbox } from "@/lib/ved/outbox-drain";
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

export async function POST(req: NextRequest) {
  if (!authorizeInternal(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const proxied = await proxyDomainApi("/v1/internal/outbox/drain", {
    method: "POST",
    userId: "worker",
    role: "ADMIN",
    body: {},
  });
  if (proxied) return forwardDomainResponse(proxied);

  const body = await req.json().catch(() => ({}));
  const limit = Number(body.limit) || 20;
  const result = await drainServiceOutbox(prisma, { limit });
  return NextResponse.json(result);
}
