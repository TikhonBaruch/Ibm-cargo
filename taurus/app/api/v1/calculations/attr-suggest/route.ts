import { NextRequest, NextResponse } from "next/server";
import { requireRole, CLIENT_ROLES } from "@/lib/require-role";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { attrSuggestInputSchema, suggestProductAttrs } from "@/lib/ved/attr-suggest";

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(CLIENT_ROLES);
  if (error) return error;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = attrSuggestInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const proxied = await proxyDomainApi("/v1/calculations/attr-suggest", {
    method: "POST",
    userId,
    role,
    body: parsed.data,
  });
  // Fail-open: domain 4xx/5xx / unreachable must not blank NewCalc chips.
  if (proxied?.ok) return forwardDomainResponse(proxied);
  if (proxied && !proxied.ok) {
    console.error("[attr-suggest] domain failed, local heuristic", proxied.status);
  }

  return NextResponse.json(suggestProductAttrs(parsed.data));
}
