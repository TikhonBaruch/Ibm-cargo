import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { listCalculationEvents } from "@/lib/ved/calculation-events";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(["CLIENT", "BROKER", "ADMIN", "SUPER_ADMIN"]);
  if (error) return error;
  const { id } = await ctx.params;
  const role = (session!.user as { role?: string }).role!;
  const userId = (session!.user as { id?: string }).id!;

  const proxied = await proxyDomainApi(`/v1/calculations/${id}/events`, {
    method: "GET",
    userId,
    role,
  });
  if (proxied) return forwardDomainResponse(proxied);

  const calc = await prisma.calculation.findUnique({
    where: { id },
    select: { id: true, clientUserId: true, brokerUserId: true },
  });
  if (!calc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "CLIENT" && calc.clientUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (role === "BROKER" && calc.brokerUserId && calc.brokerUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const events = await listCalculationEvents(prisma, id);
  return NextResponse.json({ events });
}
