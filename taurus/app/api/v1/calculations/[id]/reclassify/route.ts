/**
 * POST /api/v1/calculations/:id/reclassify — broker LLM reclassify with feedback.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, BROKER_ROLES } from "@/lib/require-role";
import { reclassifyCalculation } from "@/lib/ved/calculations";
import { proxyDomainApi, forwardDomainResponse } from "@/lib/ved/domain-api";

const schema = z.object({
  brokerFeedback: z.string().min(3).max(2000),
  itemId: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(BROKER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;
  const body = schema.parse(await req.json());
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role;

  try {
    const proxied = await proxyDomainApi(`/v1/calculations/${id}/reclassify`, {
      method: "POST",
      userId,
      role,
      body,
    });
    if (proxied) return forwardDomainResponse(proxied);

    const calc = await reclassifyCalculation({
      calculationId: id,
      brokerUserId: userId,
      brokerFeedback: body.brokerFeedback,
      itemId: body.itemId,
      actorRole: role,
      actorName: session!.user?.name || undefined,
    });
    return NextResponse.json(calc);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Reclassify failed" },
      { status: 400 }
    );
  }
}
