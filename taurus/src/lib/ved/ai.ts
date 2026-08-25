import type { AiDraftResult } from "./domain";
import { buildHeuristicDraft } from "./ai-draft-engine";
import { enrichDraftWithLlm } from "./llm-enrich";
import { tryPrecedentDraft } from "./precedent-enrich";
import { getPlatformSettings } from "./settings";

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

  if (settings.llmEnrichEnabled === false || input.skipLlmEnrich) return heuristic;
  return enrichDraftWithLlm(input, heuristic);
}
