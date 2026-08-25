import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireRole, ADMIN_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { getCompanyForAdmin, patchCompanyForAdmin } from "@/lib/ved/admin-company";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  const user = session!.user as { id?: string; role?: string };
  const { id } = await params;

  const proxied = await proxyDomainApi(`/v1/company/${id}`, {
    method: "GET",
    userId: user.id!,
    role: user.role,
  });
  if (proxied) return forwardDomainResponse(proxied);

  const company = await getCompanyForAdmin(id);
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(company);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  const user = session!.user as { id?: string; role?: string; name?: string | null };
  const { id } = await params;
  const body = await req.json();

  const proxied = await proxyDomainApi(`/v1/company/${id}`, {
    method: "PATCH",
    userId: user.id!,
    role: user.role,
    body,
  });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const company = await patchCompanyForAdmin({
      companyId: id,
      raw: body,
      actorUserId: user.id!,
      actorName: user.name,
      actorRole: user.role,
    });
    return NextResponse.json(company);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    const status = (e as { status?: number }).status || 400;
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status });
  }
}
