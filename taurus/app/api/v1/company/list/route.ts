import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";

export async function GET() {
  const { session, error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  const user = session!.user as { id?: string; role?: string };

  const proxied = await proxyDomainApi("/v1/company/list", {
    method: "GET",
    userId: user.id!,
    role: user.role,
  });
  if (proxied) return forwardDomainResponse(proxied);

  const companies = await prisma.company.findMany({
    include: {
      users: { select: { id: true, name: true, email: true, role: true } },
      _count: { select: { calculations: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(companies);
}
