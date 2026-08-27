import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { countActiveTnvedCodes, searchTnvedCodes } from "@/lib/ved/tnved";

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole(["CLIENT", "BROKER", "ADMIN", "SUPER_ADMIN"]);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role;

  const proxied = await proxyDomainApi("/v1/tnved/search", {
    method: "GET",
    userId,
    role,
    query: req.nextUrl.searchParams,
  });
  if (proxied?.ok) return forwardDomainResponse(proxied);
  if (proxied && !proxied.ok) {
    console.error("[tnved/search] domain failed, local prisma", proxied.status);
  }

  const q = req.nextUrl.searchParams.get("q") || "";
  const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
  const leafOnly = req.nextUrl.searchParams.get("leafOnly") === "1";
  const headingOnly = req.nextUrl.searchParams.get("heading") === "1";
  const [items, total] = await Promise.all([
    searchTnvedCodes(prisma, { q, limit, leafOnly, headingOnly }),
    countActiveTnvedCodes(prisma),
  ]);
  return NextResponse.json({ items, total });
}
