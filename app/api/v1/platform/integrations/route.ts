import { NextResponse } from "next/server";
import { requireRole, ADMIN_ROLES } from "@/lib/require-role";
import { getIntegrationsSnapshot } from "@/lib/ved/integrations";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  const user = session!.user as { id?: string; role?: string };
  const proxied = await proxyDomainApi("/v1/platform/integrations", {
    method: "GET",
    userId: user.id || "anonymous",
    role: user.role,
  });
  if (proxied) return forwardDomainResponse(proxied);
  return NextResponse.json(await getIntegrationsSnapshot());
}
