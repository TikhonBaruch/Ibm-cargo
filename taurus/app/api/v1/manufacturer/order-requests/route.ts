import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, MANUFACTURER_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import {
  ensureManufacturerCompany,
  loadManufacturerActor,
} from "@/lib/ved/manufacturer-sku";
import { listManufacturerRequests } from "@/lib/ved/sku-order";

function domainError(e: unknown) {
  const status = (e as { status?: number }).status || 400;
  const message = e instanceof Error ? e.message : "Error";
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole(MANUFACTURER_ROLES);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role!;
  const status = req.nextUrl.searchParams.get("status") || undefined;

  const proxied = await proxyDomainApi("/v1/manufacturer/order-requests", {
    method: "GET",
    userId,
    role,
    query: status ? `status=${encodeURIComponent(status)}` : undefined,
  });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const actor = await loadManufacturerActor(prisma, userId);
    const company = await ensureManufacturerCompany(prisma, actor);
    return NextResponse.json(await listManufacturerRequests(prisma, company.id, status));
  } catch (e) {
    return domainError(e);
  }
}
