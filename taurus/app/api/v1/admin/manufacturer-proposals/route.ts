/**
 * ADMIN: list manufacturer proposals (+ optional approved companies via ?approved=1).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import {
  listApprovedManufacturerCompanies,
  listManufacturerProposalsForAdmin,
} from "@/lib/ved/manufacturer-directory";

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  const user = session!.user as { id?: string; role?: string };
  const status = req.nextUrl.searchParams.get("status") || "PENDING";
  const q = req.nextUrl.searchParams.get("q") || undefined;
  const includeApproved = req.nextUrl.searchParams.get("approved") === "1";

  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (q) qs.set("q", q);
  if (includeApproved) qs.set("approved", "1");

  const proxied = await proxyDomainApi(`/v1/admin/manufacturer-proposals?${qs}`, {
    method: "GET",
    userId: user.id!,
    role: user.role,
  });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const proposals = await listManufacturerProposalsForAdmin(prisma, { status, q });
    if (!includeApproved) return NextResponse.json({ proposals });
    const companies = await listApprovedManufacturerCompanies(prisma, { q });
    return NextResponse.json({ proposals, companies });
  } catch (e) {
    const statusCode = (e as { status?: number }).status || 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list proposals" },
      { status: statusCode }
    );
  }
}
