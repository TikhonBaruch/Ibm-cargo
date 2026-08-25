import { NextRequest, NextResponse } from "next/server";
import { requireRole, BROKER_ROLES } from "@/lib/require-role";
import { claimCalculation } from "@/lib/ved/calculations";
import { proxyDomainApi, forwardDomainResponse } from "@/lib/ved/domain-api";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(BROKER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role;
  try {
    const proxied = await proxyDomainApi(`/v1/calculations/${id}/claim`, {
      method: "POST",
      userId,
      role,
    });
    if (proxied) return forwardDomainResponse(proxied);
    const calc = await claimCalculation({
      calculationId: id,
      brokerUserId: userId,
      actorName: session!.user?.name || undefined,
      actorRole: role,
    });
    return NextResponse.json(calc);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Claim failed" }, { status: 400 });
  }
}
