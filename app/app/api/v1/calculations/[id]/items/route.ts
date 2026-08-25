import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/require-role";
import { saveCalculationItems } from "@/lib/ved/calculations";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { productAttrsSchema } from "@/lib/ved/product-description";
import { z } from "zod";

const itemSchema = z.object({
  id: z.string().min(1),
  hsCodeFinal: z.string().min(1),
  dutyRub: z.number().optional(),
  vatRub: z.number().optional(),
  unitPrice: z.number().optional(),
  description: z.string().max(5000).nullable().optional(),
  attrs: productAttrsSchema.nullable().optional(),
});

const schema = z.object({
  hsCodeFinal: z.string().optional(),
  feeRub: z.number().int().nonnegative().optional(),
  extraFeeRub: z.number().int().nonnegative().optional(),
  extraFeeNote: z.string().max(500).nullable().optional(),
  items: z.array(itemSchema).min(1),
});

/** Draft-save mapping table without DONE (Phase 3). */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(["BROKER", "ADMIN", "SUPER_ADMIN"]);
  if (error) return error;
  const { id } = await ctx.params;
  const user = session!.user as { id?: string; name?: string | null; role?: string };
  try {
    const body = schema.parse(await req.json());
    const proxied = await proxyDomainApi(`/v1/calculations/${id}/items`, {
      method: "PATCH",
      userId: user.id!,
      role: user.role,
      body,
    });
    if (proxied) return forwardDomainResponse(proxied);

    const calc = await saveCalculationItems({
      calculationId: id,
      brokerUserId: user.id!,
      hsCodeFinal: body.hsCodeFinal,
      feeRub: body.feeRub,
      extraFeeRub: body.extraFeeRub,
      extraFeeNote: body.extraFeeNote,
      items: body.items,
      actorName: user.name || undefined,
      actorRole: user.role,
    });
    return NextResponse.json(calc);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 }
    );
  }
}
