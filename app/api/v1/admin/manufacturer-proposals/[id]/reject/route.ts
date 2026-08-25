import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { rejectManufacturerProposal } from "@/lib/ved/manufacturer-directory";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  const user = session!.user as { id?: string; role?: string };
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const proxied = await proxyDomainApi(`/v1/admin/manufacturer-proposals/${id}/reject`, {
    method: "POST",
    userId: user.id!,
    role: user.role,
    body,
  });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const result = await rejectManufacturerProposal(prisma, {
      proposalId: id,
      actorUserId: user.id!,
      raw: body,
    });
    return NextResponse.json(result);
  } catch (e) {
    const status = (e as { status?: number }).status || 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Reject failed" },
      { status }
    );
  }
}
