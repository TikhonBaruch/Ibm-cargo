import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, MANUFACTURER_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import {
  ensureManufacturerCompany,
  loadManufacturerActor,
  manufacturerCompanyPatchSchema,
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

  const proxied = await proxyDomainApi("/v1/manufacturer/company", {
    method: "GET",
    userId,
    role,
  });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const actor = await loadManufacturerActor(prisma, userId);
    const company = await ensureManufacturerCompany(prisma, actor);
    return NextResponse.json(company);
  } catch (e) {
    return domainError(e);
  }
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireRole(MANUFACTURER_ROLES);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role!;
  const body = await req.json();

  const proxied = await proxyDomainApi("/v1/manufacturer/company", {
    method: "PATCH",
    userId,
    role,
    body,
  });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const patch = manufacturerCompanyPatchSchema.parse(body);
    const actor = await loadManufacturerActor(prisma, userId);
    const company = await ensureManufacturerCompany(prisma, actor);
    const updated = await prisma.company.update({
      where: { id: company.id },
      data: {
        name: patch.name,
        inn: patch.inn,
        kpp: patch.kpp,
        legalAddress: patch.legalAddress,
        contactEmail: patch.contactEmail || undefined,
        contactPhone: patch.contactPhone,
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    return domainError(e);
  }
}
