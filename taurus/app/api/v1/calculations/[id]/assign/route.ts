import { NextRequest, NextResponse } from "next/server";
import { requireRole, ADMIN_ROLES } from "@/lib/require-role";
import { assignBroker } from "@/lib/ved/calculations";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { z } from "zod";

const schema = z.object({ brokerUserId: z.string() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  const { id } = await ctx.params;
  const body = schema.parse(await req.json());
  const user = session!.user as { id?: string; name?: string | null; role?: string };
  try {
    const proxied = await proxyDomainApi(`/v1/calculations/${id}/assign`, {
      method: "POST",
      userId: user.id!,
      role: user.role,
      body,
    });
    if (proxied) return forwardDomainResponse(proxied);

    const calc = await assignBroker({
      calculationId: id,
      brokerUserId: body.brokerUserId,
      adminUserId: user.id!,
      actorName: user.name || undefined,
      actorRole: user.role,
    });
    return NextResponse.json(calc);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Assign failed" }, { status: 400 });
  }
}
