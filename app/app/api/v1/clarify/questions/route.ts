import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, CLIENT_ROLES, BROKER_ROLES } from "@/lib/require-role";
import { weightedClarificationQuestions } from "@/lib/ved/clarify-hints/weighted";
import { heuristicClarificationQuestions } from "@/lib/ved/clarify-hints";

const bodySchema = z.object({
  desc: z.string().min(1).max(8000),
  hasDocs: z.boolean().optional(),
  includeDocsQuestion: z.boolean().optional(),
});

const ROLES = [...new Set([...CLIENT_ROLES, ...BROKER_ROLES])];

/** POST /api/v1/clarify/questions — weighted clarify chips (P2 DB + code fallback). */
export async function POST(req: NextRequest) {
  const { error } = await requireRole(ROLES);
  if (error) return error;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const input = {
    desc: parsed.data.desc,
    step: 1 as const,
    hasDocs: parsed.data.hasDocs ?? false,
    includeDocsQuestion: parsed.data.includeDocsQuestion ?? false,
    includePriceQuestions: false,
  };

  try {
    const questions = await weightedClarificationQuestions(prisma, input);
    return NextResponse.json({ engine: "clarify-hints-weighted-v1", questions });
  } catch (err) {
    console.error("[clarify/questions] weighted failed, heuristic fallback", err);
    const questions = heuristicClarificationQuestions(input);
    return NextResponse.json({ engine: "clarify-hints-heuristic-v1", questions });
  }
}
