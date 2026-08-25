import { NextRequest, NextResponse } from "next/server";
import { applyPaymentsTopupWebhook } from "@/lib/ved/payments";
import { logAction } from "@/lib/audit";

/**
 * Payments → domain TOPUP webhook (Next path when not using containers/api).
 * Auth: x-internal-key. Idempotent on paymentIntentId.
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-internal-key") || "";
  const expected = process.env.INTERNAL_API_KEY || process.env.NEXTAUTH_SECRET || "";
  if (!expected || key !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = await applyPaymentsTopupWebhook(body);
    if (!result.deduped) {
      await logAction({
        action: "TOPUP_WEBHOOK",
        entity: "company",
        entityId: body.companyId,
        details: `+${body.amountRub} · ${body.intentId || body.id || "no-intent"}`,
      });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook failed" },
      { status: 400 }
    );
  }
}
