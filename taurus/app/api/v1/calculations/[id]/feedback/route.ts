import { NextRequest, NextResponse } from "next/server";
import { requireRole, CLIENT_ROLES } from "@/lib/require-role";
import { clientFeedbackInputSchema, submitClientCalculationFeedback } from "@/lib/ved/client-feedback";
import { proxyDomainApi, forwardDomainResponse } from "@/lib/ved/domain-api";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(CLIENT_ROLES);
  if (error) return error;

  const { id } = await ctx.params;
  const userId = (session!.user as { id?: string }).id!;
  const role = (session!.user as { role?: string }).role;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = clientFeedbackInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const proxied = await proxyDomainApi(`/v1/calculations/${id}/feedback`, {
      method: "POST",
      userId,
      role,
      body: parsed.data,
    });
    if (proxied) return forwardDomainResponse(proxied);

    const calc = await submitClientCalculationFeedback({
      calculationId: id,
      clientUserId: userId,
      input: parsed.data,
    });
    return NextResponse.json(calc);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Feedback failed";
    const status =
      msg === "Not found" ? 404 : msg === "Forbidden" ? 403 : msg.includes("already") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
