import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { searchTnvedCodes, type TnvedLevel } from "@/lib/ved/tnved";

function isRankedSearchPayload(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const row = body as { ranked?: unknown; items?: unknown };
  return row.ranked === true && Array.isArray(row.items);
}

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
  if (proxied?.ok) {
    try {
      const body = await proxied.clone().json();
      if (isRankedSearchPayload(body)) return forwardDomainResponse(proxied);
      console.warn("[tnved/search] domain response unranked — using local prisma");
    } catch {
      console.warn("[tnved/search] domain JSON parse failed — using local prisma");
    }
  } else if (proxied && !proxied.ok) {
    console.error("[tnved/search] domain failed, local prisma", proxied.status);
  }

  const q = req.nextUrl.searchParams.get("q") || "";
  const codePrefix = req.nextUrl.searchParams.get("codePrefix") || "";
  const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
  const leafOnly = req.nextUrl.searchParams.get("leafOnly") === "1";
  const levelRaw = Number(req.nextUrl.searchParams.get("level") || "0");
  const level = ([2, 4, 6, 8, 10] as const).includes(levelRaw as TnvedLevel)
    ? (levelRaw as TnvedLevel)
    : undefined;

  const items = await searchTnvedCodes(prisma, { q, limit, leafOnly, codePrefix, level });
  return NextResponse.json({ items, ranked: true });
}
