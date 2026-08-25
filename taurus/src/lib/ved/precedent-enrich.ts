/**
 * Apply precedent match to AI draft (before LLM classify). Fail-open.
 */
import { prisma } from "@/lib/prisma";
import type { AiDraftResult } from "./domain";
import { findBestPrecedent, type PrecedentMatchInput } from "./verified-determinations";

export async function tryPrecedentDraft(
  input: PrecedentMatchInput & { shipmentValue?: string | number },
  fallback: AiDraftResult
): Promise<AiDraftResult | null> {
  const match = await findBestPrecedent(prisma, input);
  if (!match) return null;
  return {
    ...fallback,
    hsCode: match.hsCode,
    confidence: match.confidence,
    disclaimer: match.disclaimer,
    engine: fallback.engine || "heuristic-v1",
    llmEnrich: match.engine,
  };
}
