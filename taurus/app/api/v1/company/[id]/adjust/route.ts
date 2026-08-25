import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, ADMIN_ROLES } from "@/lib/require-role";
import { logUpdate } from "@/lib/audit";
import { forwardDomainResponse, proxyDomainApi } from "@/lib/ved/domain-api";
import { adjustCompanyBalance } from "@/lib/ved/admin-company";

const bodySchema = z.object({
  amountRub: z.number().int(),
  reason: z.string().min(3).max(500),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  const user = session!.user as { id?: string; role?: string; name?: string | null };
  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const proxied = await proxyDomainApi(`/v1/company/${id}/adjust`, {
    method: "POST",
    userId: user.id!,
    role: user.role,
    body: parsed.data,
  });
  if (proxied) return forwardDomainResponse(proxied);

  try {
    const entry = await adjustCompanyBalance({
      companyId: id,
      amountRub: parsed.data.amountRub,
      reason: parsed.data.reason,
      actorUserId: user.id!,
    });
    await logUpdate(
      "company",
      id,
      user.id || "",
      user.name || "Admin",
      user.role || "ADMIN",
      `ADJUSTMENT ${parsed.data.amountRub} ₽: ${parsed.data.reason}`
    );
    return NextResponse.json({ ok: true, entry });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Adjust failed";
    const status = /not found|No .* found/i.test(msg) ? 404 : /Insufficient|amount|reason/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
