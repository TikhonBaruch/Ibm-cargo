import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES, BROKER_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";

export async function GET() {
  const { session, error } = await requireRole([...BROKER_ROLES, ...ADMIN_ROLES]);
  if (error) return error;
  const role = (session!.user as { role?: string }).role!;
  const userId = (session!.user as { id?: string }).id!;

  if (role === "BROKER") {
    const proxied = await proxyDomainApi("/v1/payouts", { method: "GET", userId, role });
    if (proxied) return forwardDomainResponse(proxied);

    const profile = await prisma.brokerProfile.findUnique({ where: { userId } });
    if (!profile) return NextResponse.json([]);
    const payouts = await prisma.brokerPayout.findMany({
      where: { brokerProfileId: profile.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(payouts);
  }

  const payouts = await prisma.brokerPayout.findMany({
    include: { brokerProfile: { include: { user: { select: { name: true, email: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(payouts);
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  const body = (await req.json()) as { id: string; status: "PAID" | "DOCS_REQUESTED" | "ACCRUED" };
  const updated = await prisma.brokerPayout.update({
    where: { id: body.id },
    data: { status: body.status },
  });
  return NextResponse.json(updated);
}
