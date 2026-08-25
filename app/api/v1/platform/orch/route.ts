/**
 * GET /api/v1/platform/orch — admin orchestration snapshot (D26).
 * POST — retry FAILED/DEAD BackgroundJob or ServiceOutbox.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES } from "@/lib/require-role";
import { getOrchestrationHealth } from "@/lib/ved/orch-health";
import { retryBackgroundJob, retryOutboxMessage } from "@/lib/ved/orchestration";
import { z } from "zod";

export async function GET() {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;

  const [health, jobs, outbox, calls] = await Promise.all([
    getOrchestrationHealth(prisma, { windowMinutes: 15 }),
    prisma.backgroundJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        kind: true,
        status: true,
        attempts: true,
        lockedBy: true,
        lastError: true,
        createdAt: true,
        finishedAt: true,
        calculationId: true,
      },
    }),
    prisma.serviceOutbox.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        channel: true,
        template: true,
        to: true,
        status: true,
        attempts: true,
        lastError: true,
        createdAt: true,
        calculationId: true,
      },
    }),
    prisma.serviceCall.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        service: true,
        operation: true,
        status: true,
        durationMs: true,
        error: true,
        calculationId: true,
        requestMeta: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({ health, jobs, outbox, calls });
}

const retrySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("retry_job"), id: z.string().min(1) }),
  z.object({ action: z.literal("retry_outbox"), id: z.string().min(1) }),
]);

export async function POST(req: NextRequest) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;

  const body = retrySchema.parse(await req.json());
  try {
    if (body.action === "retry_job") {
      const job = await retryBackgroundJob(prisma, body.id);
      return NextResponse.json({ ok: true, job });
    }
    const outbox = await retryOutboxMessage(prisma, body.id);
    return NextResponse.json({ ok: true, outbox });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Retry failed" },
      { status }
    );
  }
}
