import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(["CLIENT", "BROKER", "ADMIN", "SUPER_ADMIN"]);
  if (error) return error;
  const { id } = await ctx.params;
  const role = (session!.user as { role?: string }).role!;
  const userId = (session!.user as { id?: string }).id!;

  const proxied = await proxyDomainApi(`/v1/calculations/${id}/pdf`, {
    method: "GET",
    userId,
    role,
  });
  if (proxied) return forwardDomainResponse(proxied);

  const calc = await prisma.calculation.findUnique({ where: { id } });
  if (!calc?.pdfHtml) {
    return NextResponse.json({ error: "PDF not ready" }, { status: 404 });
  }
  if (role === "CLIENT" && calc.clientUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return new NextResponse(calc.pdfHtml, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="report-${calc.number.replace("#", "")}.html"`,
    },
  });
}
