import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, CLIENT_ROLES } from "@/lib/require-role";
import { topupViaPaymentsOrMock } from "@/lib/ved/payments";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { z } from "zod";
import { logAction } from "@/lib/audit";

const schema = z.object({
  amountRub: z.number().int().positive().max(5_000_000),
  method: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(CLIENT_ROLES);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role!;
  const body = schema.parse(await req.json());

  // Prefer payments stub from Next when URL set; else domain proxy / local mock
  if (process.env.PAYMENTS_SERVICE_URL) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.companyId) return NextResponse.json({ error: "No company" }, { status: 404 });
    try {
      const result = await topupViaPaymentsOrMock({
        companyId: user.companyId,
        amountRub: body.amountRub,
        userId,
        method: body.method || "stub",
      });
      await logAction({
        action: "TOPUP",
        entity: "company",
        entityId: user.companyId,
        userId,
        userName: session!.user?.name || undefined,
        userRole: role,
        details: `+${body.amountRub} ₽ · ${result.provider}${result.intentId ? ` · ${result.intentId}` : ""}`,
      });
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Topup failed" },
        { status: 400 }
      );
    }
  }

  const proxied = await proxyDomainApi("/v1/company/topup", {
    method: "POST",
    userId,
    role,
    body,
  });
  if (proxied) return forwardDomainResponse(proxied);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.companyId) return NextResponse.json({ error: "No company" }, { status: 404 });

  try {
    const result = await topupViaPaymentsOrMock({
      companyId: user.companyId,
      amountRub: body.amountRub,
      userId,
      method: body.method || "mock",
    });
    await logAction({
      action: "TOPUP",
      entity: "company",
      entityId: user.companyId,
      userId,
      userName: session!.user?.name || undefined,
      userRole: role,
      details: `+${body.amountRub} ₽ · ${result.provider}`,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Topup failed" },
      { status: 400 }
    );
  }
}
