import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { z } from "zod";

const patchSchema = z.object({
  id: z.string(),
  priceRub: z.number().int().positive().optional(),
  brokerSharePct: z.number().int().min(0).max(100).optional(),
  maxPositions: z.number().int().positive().optional(),
  slaHours: z.number().int().positive().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  const user = session!.user as { id?: string; role?: string };
  const body = patchSchema.parse(await req.json());

  const proxied = await proxyDomainApi("/v1/tariffs/update", {
    method: "PATCH",
    userId: user.id!,
    role: user.role,
    body,
  });
  if (proxied) return forwardDomainResponse(proxied);

  const { id, ...data } = body;
  const updated = await prisma.tariffPlan.update({ where: { id }, data });
  return NextResponse.json(updated);
}
