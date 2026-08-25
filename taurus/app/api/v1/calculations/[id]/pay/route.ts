import { NextRequest, NextResponse } from "next/server";
import { requireRole, CLIENT_ROLES } from "@/lib/require-role";
import { payCalculation } from "@/lib/ved/calculations";
import { proxyDomainApi, forwardDomainResponse } from "@/lib/ved/domain-api";
import { z } from "zod";

const schema = z.object({
  preferredBrokerUserId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(CLIENT_ROLES);
  if (error) return error;
  const { id } = await ctx.params;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role;
  let preferredBrokerUserId: string | undefined;
  let body: { preferredBrokerUserId?: string | null } = {};
  try {
    body = schema.parse(await req.json().catch(() => ({})));
    if (body.preferredBrokerUserId !== undefined) {
      preferredBrokerUserId = body.preferredBrokerUserId || undefined;
    }
  } catch {
    /* empty body ok */
  }
  try {
    const proxied = await proxyDomainApi(`/v1/calculations/${id}/pay`, {
      method: "POST",
      userId,
      role,
      body,
    });
    if (proxied) return forwardDomainResponse(proxied);
    const calc = await payCalculation({
      calculationId: id,
      clientUserId: userId,
      preferredBrokerUserId,
      actorName: session!.user?.name || undefined,
      actorRole: role,
    });
    return NextResponse.json(calc);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Pay failed" }, { status: 400 });
  }
}
