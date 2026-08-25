/**
 * GET /api/v1/calculations/:id/chain-log — analyzable AI chain journal + ServiceCalls.
 * CLIENT (owner) / BROKER / ADMIN.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { analyzeCalcChain } from "@/lib/ved/chain-run-log";
import { isAiDrainPending } from "@/lib/ved/ai-drain-client";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(["CLIENT", "BROKER", "ADMIN", "SUPER_ADMIN"]);
  if (error) return error;

  const { id } = await ctx.params;
  const role = (session!.user as { role?: string }).role!;
  const userId = (session!.user as { id?: string }).id!;

  const calc = await prisma.calculation.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      status: true,
      hsCode: true,
      confidence: true,
      aiDraft: true,
      clientUserId: true,
      brokerUserId: true,
    },
  });
  if (!calc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (role === "CLIENT" && calc.clientUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (role === "BROKER" && calc.brokerUserId && calc.brokerUserId !== userId) {
    // Brokers may inspect queue items they don't own yet — allow read of chain log for AI_READY+
    // Keep same gate as calc GET: if not assigned and not admin, still allow when status is AI_* / QUEUED
    const open =
      calc.status === "AI_READY" ||
      calc.status === "QUEUED" ||
      calc.status === "IN_REVIEW" ||
      calc.status === "SLA_RISK";
    if (!open) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const serviceCalls = await prisma.serviceCall.findMany({
    where: { calculationId: id },
    orderBy: { createdAt: "asc" },
    take: 40,
    select: {
      id: true,
      service: true,
      operation: true,
      status: true,
      durationMs: true,
      error: true,
      createdAt: true,
      finishedAt: true,
      requestMeta: true,
      responseMeta: true,
    },
  });

  const analysis = analyzeCalcChain({
    id: calc.id,
    number: calc.number,
    status: calc.status,
    hsCode: calc.hsCode,
    confidence: calc.confidence,
    aiDrainPending: isAiDrainPending({
      aiDrainPending: undefined,
      aiDraft: calc.aiDraft,
    }),
    aiDraft: calc.aiDraft,
    serviceCalls,
  });

  return NextResponse.json({
    ...analysis,
    capturedAt: new Date().toISOString(),
  });
}
