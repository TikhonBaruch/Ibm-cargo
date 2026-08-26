import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { listTnvedChapters } from "@/lib/ved/tnved";

/** Chapter list (level 2) for directory browse UI. */
export async function GET() {
  const { session, error } = await requireRole(["CLIENT", "BROKER", "ADMIN", "SUPER_ADMIN"]);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role;

  const proxied = await proxyDomainApi("/v1/tnved/chapters", {
    method: "GET",
    userId,
    role,
  });
  if (proxied?.ok) return forwardDomainResponse(proxied);
  if (proxied && !proxied.ok) {
    console.error("[tnved/chapters] domain failed, local prisma", proxied.status);
  }

  const items = await listTnvedChapters(prisma);
  return NextResponse.json({ items, count: items.length });
}
