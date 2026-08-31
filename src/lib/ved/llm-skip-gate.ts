/**
 * C35a: skip LLM/DeepSeek classify when offline path already confident.
 * Offline engines: precedent-v1|v2, cascade-v1. Heuristic alone does not skip.
 */
import type { AiDraftResult } from "./domain";

export const OFFLINE_CLASSIFY_ENGINES = [
  "precedent-v1",
  "precedent-v2",
  "cascade-v1",
] as const;

export type OfflineClassifyEngine = (typeof OFFLINE_CLASSIFY_ENGINES)[number];

export type LlmSkipDecision = {
  skip: boolean;
  /** Product metric tag: offline-hit | llm-low-conf | (absent = will call / already called). */
  skipReason?: string;
  offlineEngine?: OfflineClassifyEngine;
  threshold: number;
};

export function llmSkipConfidenceThreshold(
  env: NodeJS.Dict<string | undefined> = process.env
): number {
  const raw = Number(env.LLM_SKIP_CONF);
  if (Number.isFinite(raw) && raw > 0 && raw <= 1) return raw;
  return 0.72;
}

export function isOfflineClassifyEngine(tag: string | null | undefined): tag is OfflineClassifyEngine {
  return Boolean(tag && (OFFLINE_CLASSIFY_ENGINES as readonly string[]).includes(tag));
}

/** Prefer llmEnrich tag (precedent), else cascade engine on draft. */
export function resolveOfflineClassifyEngine(
  draft: Pick<AiDraftResult, "engine" | "llmEnrich"> | Record<string, unknown> | null | undefined
): OfflineClassifyEngine | null {
  if (!draft) return null;
  const enrich = typeof draft.llmEnrich === "string" ? draft.llmEnrich : "";
  if (isOfflineClassifyEngine(enrich)) return enrich;
  const engine = typeof draft.engine === "string" ? draft.engine : "";
  if (isOfflineClassifyEngine(engine)) return engine;
  return null;
}

export function shouldSkipLlmClassify(
  draft: Pick<AiDraftResult, "engine" | "llmEnrich" | "confidence"> | Record<string, unknown> | null | undefined,
  env: NodeJS.Dict<string | undefined> = process.env
): LlmSkipDecision {
  const threshold = llmSkipConfidenceThreshold(env);
  const offlineEngine = resolveOfflineClassifyEngine(draft);
  if (!offlineEngine) {
    return { skip: false, threshold };
  }
  const confidence =
    typeof draft?.confidence === "number" && Number.isFinite(draft.confidence)
      ? draft.confidence
      : 0;
  if (confidence >= threshold) {
    return {
      skip: true,
      skipReason: `offline-hit:${offlineEngine}`,
      offlineEngine,
      threshold,
    };
  }
  return {
    skip: false,
    skipReason: `llm-low-conf:${offlineEngine}`,
    offlineEngine,
    threshold,
  };
}

/** Attach skip metadata; keep llmEnrich as offline engine when skipping. */
export function applyLlmSkipToDraft(draft: AiDraftResult, decision: LlmSkipDecision): AiDraftResult {
  if (!decision.skip || !decision.offlineEngine) return draft;
  return {
    ...draft,
    llmEnrich: draft.llmEnrich || decision.offlineEngine,
    // domain allows extra fields on persisted JSON; typed via index for readers
    ...(decision.skipReason ? { skipReason: decision.skipReason } : {}),
  } as AiDraftResult & { skipReason?: string };
}
