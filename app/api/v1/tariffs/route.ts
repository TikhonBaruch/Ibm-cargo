import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";

export async function GET() {
  // Tariffs are public-ish; proxy with a synthetic session when domain API is on.
  const proxied = await proxyDomainApi("/v1/tariffs", {
    method: "GET",
    userId: "system",
    role: "ADMIN",
  });
  if (proxied) return forwardDomainResponse(proxied);

  const tariffs = await prisma.tariffPlan.findMany({
    where: { isActive: true },
    orderBy: { priceRub: "asc" },
  });
  return NextResponse.json(tariffs);
}
