/**
 * POST /api/v1/imports/products/describe — single product photo → TN VED search text.
 * DeepSeek vision (chain 3) via describeForChain; fail-open JSON (no 5xx on miss).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, CLIENT_ROLES } from "@/lib/require-role";
import { optionalAllowedMediaUrlSchema } from "@/lib/ved/media-url";
import { describeProductFromMediaUrl } from "@/lib/ved/product-vision-describe";
import { resolveAiChainId, visionConfiguredForChain } from "@/lib/ved/chains";

/** DeepSeek vision budget is 90s (`OCR_TIMEOUT_MS`); platform kill otherwise shows Request ID. */
export const maxDuration = 120;

const jsonSchema = z.object({
  mediaUrl: optionalAllowedMediaUrlSchema,
  hint: z.string().max(240).optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole(CLIENT_ROLES);
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = jsonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { mediaUrl, hint } = parsed.data;
  if (!mediaUrl) {
    return NextResponse.json({ error: "mediaUrl required" }, { status: 400 });
  }

  try {
    if (!visionConfiguredForChain(resolveAiChainId())) {
      return NextResponse.json({
        ok: false,
        skipped: true,
        error: "vision not configured",
      });
    }

    const out = await describeProductFromMediaUrl({ mediaUrl, hint });
    if (!out?.description?.trim()) {
      return NextResponse.json({
        ok: false,
        skipped: true,
        error: "vision empty",
      });
    }
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    console.error("[products/describe]", e);
    return NextResponse.json({
      ok: false,
      skipped: true,
      error: e instanceof Error ? e.message : "describe failed",
    });
  }
}
