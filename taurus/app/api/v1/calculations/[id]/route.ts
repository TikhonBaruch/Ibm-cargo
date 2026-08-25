import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { listSimilarPrecedents } from "@/lib/ved/verified-determinations";
import { sanitizeProductAttrs } from "@/lib/ved/product-description";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(["CLIENT", "BROKER", "ADMIN", "SUPER_ADMIN"]);
  if (error) return error;

  const { id } = await ctx.params;
  const role = (session!.user as { role?: string }).role!;
  const userId = (session!.user as { id?: string }).id!;

  const proxied = await proxyDomainApi(`/v1/calculations/${id}`, {
    method: "GET",
    userId,
    role,
  });
  if (proxied) return forwardDomainResponse(proxied);

  const calc = await prisma.calculation.findUnique({
    where: { id },
    omit: { pdfHtml: true },
    include: {
      tariff: true,
      items: true,
      clientUser: { select: { id: true, name: true, email: true } },
      brokerUser: { select: { id: true, name: true, email: true } },
      company: true,
      chatThreads: { include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } } },
    },
  });
  if (!calc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (role === "CLIENT" && calc.clientUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pdfMeta = await prisma.calculation.findUnique({
    where: { id },
    select: { pdfHtml: true },
  });
  let similarPrecedents: unknown[] = [];
  if (role === "BROKER" || role === "ADMIN" || role === "SUPER_ADMIN") {
    const item = calc.items[0];
    similarPrecedents = await listSimilarPrecedents(prisma, {
      name: item?.name,
      title: calc.title,
      description: calc.description || item?.description || undefined,
      attrs: sanitizeProductAttrs(item?.attrs) || undefined,
    });
  }
  return NextResponse.json({
    ...calc,
    hasPdf: Boolean(pdfMeta?.pdfHtml),
    similarPrecedents,
  });
}
