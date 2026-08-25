import { NextRequest, NextResponse } from "next/server";
import { requireRole, BROKER_ROLES } from "@/lib/require-role";
import { approveCalculation } from "@/lib/ved/calculations";
import { proxyDomainApi, forwardDomainResponse } from "@/lib/ved/domain-api";
import { productAttrsSchema } from "@/lib/ved/product-description";
import { z } from "zod";

const itemSchema = z.object({
  id: z.string(),
  hsCodeFinal: z.string().min(4),
  dutyRub: z.number().int().nonnegative().optional(),
  vatRub: z.number().int().nonnegative().optional(),
  unitPrice: z.number().nonnegative().optional(),
  description: z.string().max(5000).nullable().optional(),
  attrs: productAttrsSchema.nullable().optional(),
});

const schema = z.object({
  hsCodeFinal: z.string().min(4),
  comment: z.string().optional(),
  dutyRub: z.number().int().nonnegative().optional(),
  vatRub: z.number().int().nonnegative().optional(),
  feeRub: z.number().int().nonnegative().optional(),
  extraFeeRub: z.number().int().nonnegative().optional(),
  extraFeeNote: z.string().max(500).nullable().optional(),
  items: z.array(itemSchema).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(BROKER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;
  const body = schema.parse(await req.json());
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role;
  try {
    const proxied = await proxyDomainApi(`/v1/calculations/${id}/approve`, {
      method: "POST",
      userId,
      role,
      body,
    });
    if (proxied) return forwardDomainResponse(proxied);
    const calc = await approveCalculation({
      calculationId: id,
      brokerUserId: userId,
      hsCodeFinal: body.hsCodeFinal,
      comment: body.comment,
      dutyRub: body.dutyRub,
      vatRub: body.vatRub,
      feeRub: body.feeRub,
      extraFeeRub: body.extraFeeRub,
      extraFeeNote: body.extraFeeNote,
      items: body.items,
      actorName: session!.user?.name || undefined,
      actorRole: role,
    });
    return NextResponse.json(calc);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Approve failed" }, { status: 400 });
  }
}
