/**
 * Enqueue / list durable BackgroundJob rows (D26). Worker uses POST to enqueue SLA_TICK / OUTBOX_DRAIN.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  claimBackgroundJobs,
  enqueueBackgroundJob,
  finishBackgroundJob,
} from "@/lib/ved/orchestration";
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
  const proxied = await proxyDomainApi("/v1/internal/jobs", {
    method: "GET",
    userId: "worker",
    role: "ADMIN",
  });
  if (proxied) return forwardDomainResponse(proxied);

  const jobs = await prisma.backgroundJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  if (!authorizeInternal(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action || "enqueue";

  const proxied = await proxyDomainApi("/v1/internal/jobs", {
    method: "POST",
    userId: "worker",
    role: "ADMIN",
    body,
  });
  if (proxied) return forwardDomainResponse(proxied);

  if (action === "claim") {
    const claimed = await claimBackgroundJobs(prisma, {
      lockedBy: body.lockedBy || "worker",
      limit: Number(body.limit) || 5,
      kinds: Array.isArray(body.kinds) ? body.kinds : undefined,
    });
    return NextResponse.json({ jobs: claimed });
  }

  if (action === "finish") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const job = await finishBackgroundJob(prisma, body.id, {
      ok: Boolean(body.ok),
      result: body.result,
      error: body.error,
      attempts: body.attempts,
      maxAttempts: body.maxAttempts,
    });
    return NextResponse.json({ job });
  }

  if (!body.kind) {
    return NextResponse.json({ error: "kind required" }, { status: 400 });
  }
  const job = await enqueueBackgroundJob(prisma, {
    kind: body.kind,
    payload: body.payload,
    calculationId: body.calculationId,
    paymentIntentId: body.paymentIntentId,
  });
  return NextResponse.json({ job });
}
