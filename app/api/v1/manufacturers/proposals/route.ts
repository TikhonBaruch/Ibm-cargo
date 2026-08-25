/**
 * CLIENT/BROKER propose a manufacturer (PENDING until ADMIN approve).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { createManufacturerProposal } from "@/lib/ved/manufacturer-directory";

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(["CLIENT", "BROKER"]);
  if (error) return error;
  const user = session!.user as { id?: string; role?: string };
  const body = await req.json();

  const proxied = await proxyDomainApi("/v1/manufacturers/proposals", {
    method: "POST",
    userId: user.id!,
    role: user.role,
    body,
  });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const row = await createManufacturerProposal(prisma, {
      userId: user.id!,
      role: user.role!,
      raw: body,
    });
    return NextResponse.json(row, { status: row.duplicate ? 200 : 201 });
  } catch (e) {
    const status = (e as { status?: number }).status || 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create proposal" },
      { status }
    );
  }
}
