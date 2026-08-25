import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, CLIENT_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import {
  createClientRequest,
  listClientRequests,
  requireUserCompanyId,
} from "@/lib/ved/sku-order";

function domainError(e: unknown) {
  const status = (e as { status?: number }).status || 400;
  const message = e instanceof Error ? e.message : "Error";
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const { session, error } = await requireRole(CLIENT_ROLES);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role!;

  const proxied = await proxyDomainApi("/v1/factory/requests", { method: "GET", userId, role });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const companyId = await requireUserCompanyId(prisma, userId);
    return NextResponse.json(await listClientRequests(prisma, companyId));
  } catch (e) {
    return domainError(e);
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(CLIENT_ROLES);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role!;
  const body = await req.json();

  const proxied = await proxyDomainApi("/v1/factory/requests", {
    method: "POST",
    userId,
    role,
    body,
  });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const companyId = await requireUserCompanyId(prisma, userId);
    const row = await createClientRequest(prisma, companyId, body);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return domainError(e);
  }
}
