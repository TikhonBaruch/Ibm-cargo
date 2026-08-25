import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, MANUFACTURER_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import {
  createManufacturerSku,
  ensureManufacturerCompany,
  listManufacturerSkus,
  loadManufacturerActor,
} from "@/lib/ved/manufacturer-sku";

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

  const proxied = await proxyDomainApi("/v1/manufacturer/skus", { method: "GET", userId, role });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const actor = await loadManufacturerActor(prisma, userId);
    const company = await ensureManufacturerCompany(prisma, actor);
    const rows = await listManufacturerSkus(prisma, company.id);
    return NextResponse.json(rows);
  } catch (e) {
    return domainError(e);
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(MANUFACTURER_ROLES);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role!;
  const body = await req.json();

  const proxied = await proxyDomainApi("/v1/manufacturer/skus", {
    method: "POST",
    userId,
    role,
    body,
  });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const actor = await loadManufacturerActor(prisma, userId);
    const company = await ensureManufacturerCompany(prisma, actor);
    const row = await createManufacturerSku(prisma, company.id, body);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return domainError(e);
  }
}
