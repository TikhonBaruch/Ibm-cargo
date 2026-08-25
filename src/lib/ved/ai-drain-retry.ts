/**
 * AI_DRAIN retry schedule + logging (plan-ai-mesh slice 1c).
 * Staggered delays: 30s → 2m → 5m → 15m → DEAD.
 * Vision-before-classify budgets: plan-vision-before-classify.md
 */
import type { EnvBag } from "../env-bag";

export const AI_DRAIN_MAX_ATTEMPTS = 6;

/** Default wait for Qwen-VL describe (+ media fetch). Override: OCR_TIMEOUT_MS. */
export const VISION_DESCRIBE_TIMEOUT_MS_DEFAULT = 90_000;

/** Default wait for classify after vision. Override: LLM_TIMEOUT_MS. */
export const CLASSIFY_TIMEOUT_MS_DEFAULT = 120_000;

export function visionDescribeTimeoutMs(env: EnvBag = process.env): number {
  const n = Number(env.OCR_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : VISION_DESCRIBE_TIMEOUT_MS_DEFAULT;
}

export function classifyTimeoutMs(env: EnvBag = process.env): number {
  const n = Number(env.LLM_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : CLASSIFY_TIMEOUT_MS_DEFAULT;
}

/** True on final AI_DRAIN attempt — allow classify without vision (fail-open). */
export function aiDrainAllowClassifyWithoutVision(opts: {
  attempt: number;
  maxAttempts?: number;
}): boolean {
  const max = opts.maxAttempts ?? AI_DRAIN_MAX_ATTEMPTS;
  return opts.attempt >= max;
}

/** Delay before the *next* attempt after a failed attempt `failedAttempt` (1-based). */
export const AI_DRAIN_RETRY_DELAYS_MS = [
  30_000, // after 1st fail → retry in 30s
  120_000, // 2m
  300_000, // 5m
  900_000, // 15m
] as const;

export function aiDrainRetryDelayMs(failedAttempt: number): number {
  const idx = Math.max(0, Math.min(failedAttempt - 1, AI_DRAIN_RETRY_DELAYS_MS.length - 1));
  return AI_DRAIN_RETRY_DELAYS_MS[idx];
}

export function aiDrainShouldRequeue(opts: {
  retriable: boolean;
  attempts: number;
  maxAttempts?: number;
}): boolean {
  const max = opts.maxAttempts ?? AI_DRAIN_MAX_ATTEMPTS;
  return opts.retriable && opts.attempts < max;
}

export type AiDrainLogEvent = {
  phase: string;
  calculationId?: string;
  jobId?: string;
  attempt?: number;
  provider?: string;
  ok?: boolean;
  retriable?: boolean;
  error?: string;
  hsCode?: string | null;
  engine?: string;
  delayMs?: number;
  extra?: Record<string, unknown>;
};

/** Structured log for drain/failover (no secrets / no image bytes). */
export function logAiDrain(event: AiDrainLogEvent): void {
  const line = {
    ts: new Date().toISOString(),
    scope: "ai-drain",
    ...event,
  };
  // eslint-disable-next-line no-console
  console.info("[ai-drain]", JSON.stringify(line));
}

export type VisionTraceEvent = {
  ts: string;
  phase: string;
  ok?: boolean;
  error?: string;
  status?: number;
  mime?: string;
  bytes?: number;
  errorCode?: string;
  descriptionLen?: number;
  qwenHttpStatus?: number;
  mode?: string;
};

const VISION_TRACE_MAX = 8;

/** Append a short vision step to aiDraft.visionTrace (no URLs / no bytes). */
export function appendVisionTrace(
  draft: Record<string, unknown> | null | undefined,
  event: Omit<VisionTraceEvent, "ts"> & { ts?: string }
): Record<string, unknown> {
  const prev = (draft || {}) as Record<string, unknown>;
  const raw = Array.isArray(prev.visionTrace) ? prev.visionTrace : [];
  const nextEvent: VisionTraceEvent = {
    ts: event.ts || new Date().toISOString(),
    phase: event.phase,
    ...(event.ok != null ? { ok: event.ok } : {}),
    ...(event.error ? { error: String(event.error).slice(0, 200) } : {}),
    ...(event.status != null ? { status: event.status } : {}),
    ...(event.mime ? { mime: event.mime } : {}),
    ...(event.bytes != null ? { bytes: event.bytes } : {}),
    ...(event.errorCode ? { errorCode: event.errorCode } : {}),
    ...(event.descriptionLen != null ? { descriptionLen: event.descriptionLen } : {}),
    ...(event.qwenHttpStatus != null ? { qwenHttpStatus: event.qwenHttpStatus } : {}),
    ...(event.mode ? { mode: event.mode } : {}),
  };
  const visionTrace = [...raw.filter((x) => x && typeof x === "object"), nextEvent].slice(
    -VISION_TRACE_MAX
  );
  return { ...prev, visionTrace };
}

/** Client-facing soft-fail codes (no HTTP bodies / no keys). */
export const LLM_SOFT_FAIL = {
  VISION_QWEN: "vision-qwen",
  VISION_DEEPSEEK: "vision-deepseek",
  CLASSIFY_DEEPSEEK: "classify-deepseek",
  CLASSIFY_QWEN: "classify-qwen",
  CLASSIFY_CHAIN: "classify-chain",
  DRAIN_DEAD: "drain-dead",
} as const;

export type LlmSoftFailCode = (typeof LLM_SOFT_FAIL)[keyof typeof LLM_SOFT_FAIL] | string;

const SOFT_FAIL_LABELS: Record<string, string> = {
  [LLM_SOFT_FAIL.VISION_QWEN]: "распознавание фото (Qwen)",
  [LLM_SOFT_FAIL.VISION_DEEPSEEK]: "распознавание фото (DeepSeek)",
  [LLM_SOFT_FAIL.CLASSIFY_DEEPSEEK]: "классификация DeepSeek",
  [LLM_SOFT_FAIL.CLASSIFY_QWEN]: "классификация Qwen",
  [LLM_SOFT_FAIL.CLASSIFY_CHAIN]: "основная LLM-классификация",
  [LLM_SOFT_FAIL.DRAIN_DEAD]: "AI-обогащение после нескольких попыток",
};

export function clientLabelForLlmSoftFail(code: string): string {
  return SOFT_FAIL_LABELS[code] || "одна из LLM";
}

/** Test-mode sentence for client report / PDF disclaimer. */
export function formatTestModeLlmNotice(codes: string[]): string | null {
  const uniq = [...new Set(codes.filter(Boolean))];
  if (!uniq.length) return null;
  const labels = uniq.map(clientLabelForLlmSoftFail);
  return `Тестовый режим: не сработало — ${labels.join(", ")}. Использован запасной путь; код предварительный.`;
}

export function appendLlmSoftFails(
  draft: Record<string, unknown> | null | undefined,
  codes: string[]
): Record<string, unknown> {
  const prev = (draft || {}) as Record<string, unknown>;
  const raw = Array.isArray(prev.llmSoftFails) ? prev.llmSoftFails.map(String) : [];
  const llmSoftFails = [...new Set([...raw, ...codes.filter(Boolean)])].slice(0, 8);
  const notice = formatTestModeLlmNotice(llmSoftFails);
  const baseDisclaimer = String(prev.disclaimer || "").trim();
  let disclaimer = baseDisclaimer;
  if (notice) {
    // Drop prior test-mode sentence to avoid duplicates on retries.
    const withoutNotice = baseDisclaimer
      .replace(/Тестовый режим:[^.]*\.\s*Использован запасной путь;[^.]*\.?\s*/gi, "")
      .trim();
    disclaimer = [withoutNotice, notice].filter(Boolean).join(" ");
  }
  return { ...prev, llmSoftFails, ...(disclaimer ? { disclaimer } : {}) };
}

/** Map OpenAI-compat profile id → soft-fail code. */
export function softFailCodeForClassifyProfile(profile: string): string {
  const p = profile.toLowerCase();
  if (p.includes("deepseek")) return LLM_SOFT_FAIL.CLASSIFY_DEEPSEEK;
  if (p.includes("qwen")) return LLM_SOFT_FAIL.CLASSIFY_QWEN;
  return LLM_SOFT_FAIL.CLASSIFY_CHAIN;
}
