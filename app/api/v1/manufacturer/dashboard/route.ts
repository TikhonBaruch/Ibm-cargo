import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, MANUFACTURER_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import {
  ensureManufacturerCompany,
  loadManufacturerActor,
  manufacturerDashboard,
} from "@/lib/ved/manufacturer-sku";
import { manufacturerOrderKpis } from "@/lib/ved/sku-order";

function domainError(e: unknown) {
  const status = (e as { status?: number }).status || 400;
  const message = e instanceof Error ? e.message : "Error";
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const { session, error } = await requireRole(MANUFACTURER_ROLES);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role!;

  const proxied = await proxyDomainApi("/v1/manufacturer/dashboard", {
    method: "GET",
    userId,
    role,
  });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const actor = await loadManufacturerActor(prisma, userId);
    const company = await ensureManufacturerCompany(prisma, actor);
    const dash = await manufacturerDashboard(prisma, company.id);
    const orders = await manufacturerOrderKpis(prisma, company.id);
    return NextResponse.json({ company, ...dash, ...orders });
  } catch (e) {
    return domainError(e);
  }
}
