import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, MANUFACTURER_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import {
  ensureManufacturerCompany,
  getManufacturerSku,
  loadManufacturerActor,
  patchManufacturerSku,
} from "@/lib/ved/manufacturer-sku";

function domainError(e: unknown) {
  const status = (e as { status?: number }).status || 400;
  const message = e instanceof Error ? e.message : "Error";
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(MANUFACTURER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role!;

  const proxied = await proxyDomainApi(`/v1/manufacturer/skus/${id}`, {
    method: "GET",
    userId,
    role,
  });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const actor = await loadManufacturerActor(prisma, userId);
    const company = await ensureManufacturerCompany(prisma, actor);
    const row = await getManufacturerSku(prisma, company.id, id);
    return NextResponse.json(row);
  } catch (e) {
    return domainError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(MANUFACTURER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role!;
  const body = await req.json();

  const proxied = await proxyDomainApi(`/v1/manufacturer/skus/${id}`, {
    method: "PATCH",
    userId,
    role,
    body,
  });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const actor = await loadManufacturerActor(prisma, userId);
    const company = await ensureManufacturerCompany(prisma, actor);
    const row = await patchManufacturerSku(prisma, company.id, id, body);
    return NextResponse.json(row);
  } catch (e) {
    return domainError(e);
  }
}
