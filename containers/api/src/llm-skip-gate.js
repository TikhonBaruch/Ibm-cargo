/**
 * C35a: skip LLM/DeepSeek classify when offline path already confident.
 * Mirror of src/lib/ved/llm-skip-gate.ts — keep thresholds/engines in sync.
 */

export const OFFLINE_CLASSIFY_ENGINES = ["precedent-v1", "precedent-v2", "cascade-v1"];

export function llmSkipConfidenceThreshold(env = process.env) {
  const raw = Number(env.LLM_SKIP_CONF);
  if (Number.isFinite(raw) && raw > 0 && raw <= 1) return raw;
  return 0.72;
}

export function isOfflineClassifyEngine(tag) {
  return Boolean(tag && OFFLINE_CLASSIFY_ENGINES.includes(tag));
}

/** Prefer llmEnrich tag (precedent), else cascade engine on draft. */
export function resolveOfflineClassifyEngine(draft) {
  if (!draft) return null;
  const enrich = typeof draft.llmEnrich === "string" ? draft.llmEnrich : "";
  if (isOfflineClassifyEngine(enrich)) return enrich;
  const engine = typeof draft.engine === "string" ? draft.engine : "";
  if (isOfflineClassifyEngine(engine)) return engine;
  return null;
}

export function shouldSkipLlmClassify(draft, env = process.env) {
  const threshold = llmSkipConfidenceThreshold(env);
  const offlineEngine = resolveOfflineClassifyEngine(draft);
  if (!offlineEngine) {
    return { skip: false, threshold };
  }
  const confidence =
    typeof draft?.confidence === "number" && Number.isFinite(draft.confidence) ? draft.confidence : 0;
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

export function applyLlmSkipToDraft(draft, decision) {
  if (!decision.skip || !decision.offlineEngine) return draft;
  return {
    ...draft,
    llmEnrich: draft.llmEnrich || decision.offlineEngine,
    ...(decision.skipReason ? { skipReason: decision.skipReason } : {}),
  };
}
