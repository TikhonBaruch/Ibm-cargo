import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, DOMAIN_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";

export async function GET() {
  const { session, error } = await requireRole(DOMAIN_ROLES);
  if (error) return error;

  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role!;

  const proxied = await proxyDomainApi("/v1/me", { method: "GET", userId, role });
  if (proxied) return forwardDomainResponse(proxied);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      company: { include: { ledger: { orderBy: { createdAt: "desc" }, take: 50 } } },
      brokerProfile: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone,
    company: user.company,
    brokerProfile: user.brokerProfile,
  });
}
