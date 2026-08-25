import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES, CLIENT_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { resolveBrokersListFilter } from "@/lib/ved/platform-gates";
import { patchBrokerForAdmin } from "@/lib/ved/admin-broker";

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole([...CLIENT_ROLES, "BROKER", ...ADMIN_ROLES]);
  if (error) return error;
  const role = (session!.user as { role?: string }).role!;
  const userId = (session!.user as { id?: string }).id!;

  const proxied = await proxyDomainApi("/v1/brokers", {
    method: "GET",
    userId,
    role,
    query: req.nextUrl.searchParams,
  });
  if (proxied) return forwardDomainResponse(proxied);

  const all = req.nextUrl.searchParams.get("all") === "1" || ADMIN_ROLES.includes(role as "ADMIN" | "SUPER_ADMIN");
  const filter = await resolveBrokersListFilter({ all, role });
  if (filter.empty) return NextResponse.json([]);

  const brokers = await prisma.brokerProfile.findMany({
    where: filter.where,
    include: { user: { select: { id: true, name: true, email: true, image: true, phone: true } } },
    orderBy: { rating: "desc" },
  });
  return NextResponse.json(brokers);
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  const user = session!.user as { id?: string; role?: string };
  const body = await req.json();

  const proxied = await proxyDomainApi("/v1/brokers", {
    method: "PATCH",
    userId: user.id!,
    role: user.role,
    body,
  });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const updated = await patchBrokerForAdmin(body);
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
