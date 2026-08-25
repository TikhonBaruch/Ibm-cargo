/**
 * Published factory SKU catalog for CLIENT (and broker read). Not manufacturer CRUD.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, DOMAIN_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { listPublishedCatalogSkus } from "@/lib/ved/manufacturer-sku";
import { attachOpenPoolSummaries } from "@/lib/ved/sku-order";

export async function GET() {
  const { session, error } = await requireRole(DOMAIN_ROLES);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role!;

  const proxied = await proxyDomainApi("/v1/catalog/skus", { method: "GET", userId, role });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const rows = await listPublishedCatalogSkus(prisma);
    return NextResponse.json(await attachOpenPoolSummaries(prisma, rows));
  } catch (e) {
    const status = (e as { status?: number }).status || 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load catalog" },
      { status }
    );
  }
}
