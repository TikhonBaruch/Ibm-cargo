import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { guardSuggestQuery } from "@/lib/ved/precedent-suggest/query-guard";
import { rankCascadeCandidates } from "@/lib/ved/tnved-classify";

/** Debounced cascade preview for NewCalc (C26). Deterministic — not LLM. */
export async function GET(req: NextRequest) {
  const { error } = await requireRole(["CLIENT", "BROKER", "ADMIN", "SUPER_ADMIN"]);
  if (error) return error;

  const q = String(req.nextUrl.searchParams.get("q") || "").trim();
  const guard = guardSuggestQuery(q);
  if (!guard.ok) {
    return NextResponse.json({ items: [] });
  }

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || "3"), 1), 5);
  try {
    const items = await rankCascadeCandidates(prisma, { description: q }, limit);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
