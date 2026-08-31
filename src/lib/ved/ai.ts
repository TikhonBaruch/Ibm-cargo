import { prisma } from "@/lib/prisma";
import type { AiDraftResult } from "./domain";
import { buildHeuristicDraft } from "./ai-draft-engine";
import { enrichDraftWithLlm } from "./llm-enrich";
import { applyLlmSkipToDraft, shouldSkipLlmClassify } from "./llm-skip-gate";
import { tryPrecedentDraft } from "./precedent-enrich";
import { getPlatformSettings } from "./settings";
import { buildCascadeDraft, pickCascadeOrHeuristic } from "./tnved-classify";

/**
 * C3: prefer containers/ai via AI_SERVICE_URL; local heuristic + optional LLM enrich.
 * Precedent (БД-2) checked first when llmEnrichEnabled — before AI/LLM (fail-open).
 */
export async function requestAiDraft(input: {
  description: string;
  country?: string;
  title?: string;
  name?: string;
  attrs?: import("./product-description").ProductAttrs | null;
  docs?: string[];
  shipmentValue?: string | number;
  /** Server OCR / vision text merged into classify query (C25). */
  ocrText?: string | null;
  /** When AI_DRAIN will classify — skip sync DeepSeek (one model call, create stays fast). */
  skipLlmEnrich?: boolean;
}): Promise<AiDraftResult> {
  const heuristic = buildHeuristicDraft(input);
  const settings = await getPlatformSettings();

  if (settings.llmEnrichEnabled !== false) {
    const precedent = await tryPrecedentDraft(
      {
        title: input.title,
        description: input.description,
        name: input.name || input.title,
        attrs: input.attrs,
      },
      heuristic
    );
    if (precedent) return precedent;
  }

  let draftBase: AiDraftResult = heuristic;
  try {
    const cascade = await buildCascadeDraft(prisma, {
      title: input.title,
      description: input.description,
      name: input.name || input.title,
      country: input.country,
      ocrText: input.ocrText,
      shipmentValue: input.shipmentValue,
    });
    draftBase = pickCascadeOrHeuristic(cascade, heuristic);
  } catch {
    draftBase = heuristic;
  }

  const base = (process.env.AI_SERVICE_URL || process.env.AI_URL || "").replace(/\/$/, "");
  if (base) {
    try {
      const res = await fetch(`${base}/v1/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS || process.env.LLM_TIMEOUT_MS || 35000)),
      });
      if (res.ok) {
        return (await res.json()) as AiDraftResult;
      }
    } catch {
      // fall through
    }
  }

  if (settings.llmEnrichEnabled === false || input.skipLlmEnrich) return draftBase;

  // C35a: do not call DeepSeek/LLM when cascade/precedent already confident.
  const skip = shouldSkipLlmClassify(draftBase);
  if (skip.skip) return applyLlmSkipToDraft(draftBase, skip);
  const withReason = skip.skipReason
    ? ({ ...draftBase, skipReason: skip.skipReason } as AiDraftResult)
    : draftBase;

  return enrichDraftWithLlm(input, withReason);
}
