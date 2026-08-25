/**
 * POST /api/v1/internal/ai-drain — worker runs Qwen→DeepSeek pipeline for one calc.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { finishQueuedAiDrainForCalc } from "@/lib/ved/ai-pipeline";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";

/** Allow full Qwen-VL (≤90s) + classify (≤120s) + reset headroom. */
export const maxDuration = 300;

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
  const body = await req.json().catch(() => ({}));
  const calculationId = String(body.calculationId || "").trim();
  if (!calculationId) {
    return NextResponse.json({ error: "calculationId required" }, { status: 400 });
  }

  const proxied = await proxyDomainApi("/v1/internal/ai-drain", {
    method: "POST",
    userId: "worker",
    role: "ADMIN",
    body: { calculationId, jobId: body.jobId },
  });
  if (proxied) return forwardDomainResponse(proxied);

  const result = await finishQueuedAiDrainForCalc(prisma, calculationId);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
