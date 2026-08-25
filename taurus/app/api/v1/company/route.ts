import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, CLIENT_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(2).optional(),
  inn: z.string().optional(),
  kpp: z.string().optional(),
  legalAddress: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  clientSegment: z.enum(["SINGLE", "RETAIL_SMALL", "WHOLESALE"]).optional(),
});

export async function GET() {
  const { session, error } = await requireRole(CLIENT_ROLES);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role;

  const proxied = await proxyDomainApi("/v1/company", {
    method: "GET",
    userId,
    role,
  });
  if (proxied) return forwardDomainResponse(proxied);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { company: { include: { ledger: { orderBy: { createdAt: "desc" }, take: 50 } } } },
  });
  if (!user?.company) return NextResponse.json({ error: "No company" }, { status: 404 });
  return NextResponse.json(user.company);
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireRole(CLIENT_ROLES);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role;
  const body = profileSchema.parse(await req.json());

  const proxied = await proxyDomainApi("/v1/company", {
    method: "PATCH",
    userId,
    role,
    body,
  });
  if (proxied) return forwardDomainResponse(proxied);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.companyId) return NextResponse.json({ error: "No company" }, { status: 404 });
  const company = await prisma.company.update({
    where: { id: user.companyId },
    data: {
      name: body.name,
      inn: body.inn,
      kpp: body.kpp,
      legalAddress: body.legalAddress,
      contactEmail: body.contactEmail || undefined,
      contactPhone: body.contactPhone,
      clientSegment: body.clientSegment,
    },
  });
  return NextResponse.json(company);
}
