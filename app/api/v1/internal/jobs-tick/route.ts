/**
 * POST|GET /api/v1/internal/jobs-tick — Vercel Pro cron: SLA + outbox + AI_DRAIN claim/run.
 * Auth: INTERNAL_API_KEY, CRON_SECRET, or NEXTAUTH_SECRET (Vercel Cron sends Bearer CRON_SECRET).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runJobsTick } from "@/lib/ved/jobs-tick";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

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

async function handle(req: NextRequest) {
  if (!authorizeInternal(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runJobsTick(prisma, {
    lockedBy: `vercel-cron`,
  });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
