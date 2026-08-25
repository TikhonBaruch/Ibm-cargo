/**
 * Manufacturer directory hints (approved companies + own PENDING proposals).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { listManufacturerDirectory } from "@/lib/ved/manufacturer-directory";

const DIRECTORY_ROLES = ["CLIENT", "BROKER", "ADMIN", "SUPER_ADMIN"] as const;

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole([...DIRECTORY_ROLES]);
  if (error) return error;
  const user = session!.user as { id?: string; role?: string };
  const q = req.nextUrl.searchParams.get("q") || undefined;

  const proxied = await proxyDomainApi(
    `/v1/manufacturers/directory${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    { method: "GET", userId: user.id!, role: user.role }
  );
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const rows = await listManufacturerDirectory(prisma, { userId: user.id!, q });
    return NextResponse.json(rows);
  } catch (e) {
    const status = (e as { status?: number }).status || 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load directory" },
      { status }
    );
  }
}
