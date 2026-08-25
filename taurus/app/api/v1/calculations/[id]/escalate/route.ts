import { NextRequest, NextResponse } from "next/server";
import { requireRole, BROKER_ROLES } from "@/lib/require-role";
import { escalateSla } from "@/lib/ved/calculations";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(BROKER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;
  const user = session!.user as { id?: string; name?: string | null; role?: string };

  const proxied = await proxyDomainApi(`/v1/calculations/${id}/escalate`, {
    method: "POST",
    userId: user.id!,
    role: user.role,
    body: {},
  });
  if (proxied) return forwardDomainResponse(proxied);

  const calc = await escalateSla({
    calculationId: id,
    adminUserId: user.id!,
    actorName: user.name || undefined,
    actorRole: user.role,
  });
  return NextResponse.json(calc);
}
