import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { getTnvedCard } from "@/lib/ved/tnved";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const { session, error } = await requireRole(["CLIENT", "BROKER", "ADMIN", "SUPER_ADMIN"]);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role;
  const { code } = await ctx.params;

  const proxied = await proxyDomainApi(`/v1/tnved/${encodeURIComponent(code)}`, {
    method: "GET",
    userId,
    role,
  });
  if (proxied) return forwardDomainResponse(proxied);

  const row = await getTnvedCard(prisma, decodeURIComponent(code));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}
