import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, CLIENT_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { cancelClientRequest, requireUserCompanyId } from "@/lib/ved/sku-order";

function domainError(e: unknown) {
  const status = (e as { status?: number }).status || 400;
  const message = e instanceof Error ? e.message : "Error";
  return NextResponse.json({ error: message }, { status });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(CLIENT_ROLES);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role!;
  const { id } = await params;

  const proxied = await proxyDomainApi(`/v1/factory/requests/${id}/cancel`, {
    method: "POST",
    userId,
    role,
    body: {},
  });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const companyId = await requireUserCompanyId(prisma, userId);
    return NextResponse.json(await cancelClientRequest(prisma, companyId, id));
  } catch (e) {
    return domainError(e);
  }
}
