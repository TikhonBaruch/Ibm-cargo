/**
 * Sequential Qwen-VL → reset → DeepSeek classify (plan-ai-mesh slice 1).
 * Runs on BackgroundJob AI_DRAIN. Create: heuristic + llmEnrichPending; drain via after()/worker.
 */
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  deepseekVisionConfigured,
  providerClassifyConfigured,
  qwenVisionConfigured,
} from "./openai-compat";
import {
  classifyConfiguredForChain,
  classifyForChain,
  classifyTransport,
  describeForChain,
  resetOcrSessionForChain,
  resolveAiChainId,
  visionConfiguredForChain,
  visionModeForChain,
  visionPhasesForChain,
  visionSoftFailForChain,
  visionTransport,
} from "./chains";
import {
  AI_DRAIN_MAX_ATTEMPTS,
  LLM_SOFT_FAIL,
  aiDrainAllowClassifyWithoutVision,
  aiDrainRetryDelayMs,
  aiDrainShouldRequeue,
  appendLlmSoftFails,
  appendVisionTrace,
  classifyTimeoutMs,
  logAiDrain,
  visionDescribeTimeoutMs,
  type VisionTraceEvent,
} from "./ai-drain-retry";
import {
  classifyServiceError,
  completeServiceCall,
  finishBackgroundJob,
  recordServiceCall,
} from "./orchestration";
import { fillEmptyProductAttrs, sanitizeProductAttrs, type ProductAttrs } from "./product-description";
import { isAllowedMediaUrl } from "./media-url";
import { normalizeHsCode } from "./tnved";
import {
  buildChainRunSnapshot,
  mergeChainRunIntoDraft,
} from "./chain-run-log";
type Db = PrismaClient;

export type PipelineSettings = { llmEnrichEnabled?: boolean | null };

async function persistVisionTrace(
  db: Db,
  calculationId: string,
  event: Omit<VisionTraceEvent, "ts"> & { ts?: string }
): Promise<void> {
  const calc = await db.calculation.findUnique({
    where: { id: calculationId },
    select: { aiDraft: true },
  });
  const draft = (calc?.aiDraft as Record<string, unknown> | null) || {};
  await db.calculation.update({
    where: { id: calculationId },
    data: { aiDraft: appendVisionTrace(draft, event) as object },
  });
}

async function persistLlmSoftFails(db: Db, calculationId: string, codes: string[]): Promise<void> {
  if (!codes.length) return;
  const calc = await db.calculation.findUnique({
    where: { id: calculationId },
    select: { aiDraft: true },
  });
  const draft = (calc?.aiDraft as Record<string, unknown> | null) || {};
  await db.calculation.update({
    where: { id: calculationId },
    data: { aiDraft: appendLlmSoftFails(draft, codes) as object },
  });
}

export function shouldEnqueueAiDrain(
  settings: PipelineSettings | null | undefined,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (settings?.llmEnrichEnabled === false) return false;
  const ocr = String(env.OCR_SERVICE_URL || "").replace(/\/$/, "");
  const llm = String(env.LLM_SERVICE_URL || "").replace(/\/$/, "");
  // Vercel / Mode A: keys without docker service URLs
  return Boolean(ocr || llm || providerClassifyConfigured(env) || qwenVisionConfigured(env) || deepseekVisionConfigured(env));
}

/** Client/API: treat HS as provisional while AI_DRAIN pending. */
export { isAiDrainPending } from "./ai-drain-client";

async function clearLlmEnrichPending(db: Db, calculationId: string): Promise<void> {
  const calc = await db.calculation.findUnique({
    where: { id: calculationId },
    select: { aiDraft: true },
  });
  const draft = (calc?.aiDraft as Record<string, unknown> | null) || {};
  if (draft.llmEnrichPending !== true) return;
  const { llmEnrichPending: _drop, ...rest } = draft;
  await db.calculation.update({
    where: { id: calculationId },
    data: { aiDraft: { ...rest, llmEnrichPending: false } },
  });
}

/** Persist analyzable chainRun on aiDraft (fail-open). */
async function persistChainRunSnapshot(
  db: Db,
  calculationId: string,
  drain: AiDrainResult,
  attempt: number
): Promise<void> {
  try {
    const calc = await db.calculation.findUnique({
      where: { id: calculationId },
      select: { aiDraft: true, hsCode: true, confidence: true },
    });
    const draft = (calc?.aiDraft as Record<string, unknown> | null) || {};
    const calls = await db.serviceCall.findMany({
      where: { calculationId },
      orderBy: { createdAt: "asc" },
      take: 24,
      select: {
        id: true,
        service: true,
        operation: true,
        status: true,
        durationMs: true,
        error: true,
        createdAt: true,
        finishedAt: true,
        responseMeta: true,
      },
    });
    const softFails = Array.isArray(draft.llmSoftFails)
      ? draft.llmSoftFails.map(String)
      : undefined;
    const chainRun = buildChainRunSnapshot({
      draft,
      attempt,
      visionTransport: visionTransport(),
      classifyTransport: classifyTransport(),
      serviceCalls: calls.map((c) => ({
        id: c.id,
        service: c.service,
        operation: c.operation,
        status: c.status,
        durationMs: c.durationMs,
        error: c.error,
        createdAt: c.createdAt,
        finishedAt: c.finishedAt,
        responseMeta: c.responseMeta,
      })),
      result: {
        ok: Boolean(drain.ok && (drain.hsCode || drain.skipped)),
        hsCode: drain.hsCode || calc?.hsCode || null,
        engine: drain.engine,
        confidence: typeof calc?.confidence === "number" ? calc.confidence : undefined,
        pending: draft.llmEnrichPending === true,
        error: drain.error,
        softFails,
      },
    });
    await db.calculation.update({
      where: { id: calculationId },
      data: { aiDraft: mergeChainRunIntoDraft(draft, chainRun) as object },
    });
  } catch (e) {
    logAiDrain({
      phase: "chain-run-persist-fail",
      calculationId,
      attempt,
      ok: false,
      error: e instanceof Error ? e.message : "persist failed",
    });
  }
}

/**
 * Run pipeline and mark the latest QUEUED/RUNNING AI_DRAIN job done / requeue / dead.
 * Used by Next `after()`, jobs-tick, and internal ai-drain.
 */
export async function finishQueuedAiDrainForCalc(
  db: Db,
  calculationId: string
): Promise<AiDrainResult> {
  const job = await db.backgroundJob.findFirst({
    where: {
      calculationId,
      kind: "AI_DRAIN",
      status: { in: ["QUEUED", "RUNNING"] },
    },
    orderBy: { createdAt: "desc" },
  });

  let attempt = 1;
  let jobId: string | undefined = job?.id;

  if (job) {
    if (job.status === "QUEUED") {
      // after() path: claim + bump attempts
      const claimed = await db.backgroundJob.updateMany({
        where: { id: job.id, status: "QUEUED" },
        data: {
          status: "RUNNING",
          attempts: { increment: 1 },
          lockedAt: new Date(),
          lockedBy: "ai-drain",
        },
      });
      if (claimed.count === 0) {
        logAiDrain({ phase: "drain-claim-lost", calculationId, jobId: job.id });
        return { ok: true, skipped: true, engine: "claim-lost" };
      }
      attempt = (job.attempts || 0) + 1;
    } else {
      // Already RUNNING (cron claimBackgroundJobs already incremented)
      attempt = Math.max(1, job.attempts || 1);
    }
    jobId = job.id;
  }

  logAiDrain({
    phase: "drain-start",
    calculationId,
    jobId,
    attempt,
  });

  const drain = await runAiDrainPipeline(db, { calculationId, attempt });
  await persistChainRunSnapshot(db, calculationId, drain, attempt);

  if (!jobId) {
    if (!drain.ok || drain.skipped || !drain.hsCode) {
      await clearLlmEnrichPending(db, calculationId);
    }
    logAiDrain({
      phase: "drain-no-job",
      calculationId,
      ok: drain.ok,
      hsCode: drain.hsCode,
      engine: drain.engine,
      error: drain.error,
    });
    return drain;
  }

  const success = Boolean(drain.ok && drain.hsCode);
  if (success) {
    await finishBackgroundJob(db, jobId, {
      ok: true,
      result: drain as unknown as Record<string, unknown>,
      attempts: attempt,
      maxAttempts: AI_DRAIN_MAX_ATTEMPTS,
    });
    logAiDrain({
      phase: "drain-done",
      calculationId,
      jobId,
      attempt,
      ok: true,
      hsCode: drain.hsCode,
      engine: drain.engine,
    });
    return drain;
  }

  // Soft skip (no providers / no media path) — settle pending
  if (drain.ok && drain.skipped && !drain.retriable) {
    await finishBackgroundJob(db, jobId, {
      ok: true,
      result: drain as unknown as Record<string, unknown>,
      attempts: attempt,
      maxAttempts: AI_DRAIN_MAX_ATTEMPTS,
    });
    await clearLlmEnrichPending(db, calculationId);
    logAiDrain({
      phase: "drain-skipped",
      calculationId,
      jobId,
      attempt,
      engine: drain.engine,
    });
    return drain;
  }

  const retriable = Boolean(drain.retriable);
  const willRequeue = aiDrainShouldRequeue({ retriable, attempts: attempt });
  const delayMs = aiDrainRetryDelayMs(attempt);

  await finishBackgroundJob(db, jobId, {
    ok: false,
    result: drain as unknown as Record<string, unknown>,
    error: drain.error || "ai-drain failed",
    attempts: attempt,
    maxAttempts: AI_DRAIN_MAX_ATTEMPTS,
    retryDelayMs: delayMs,
  });

  if (!willRequeue) {
    await clearLlmEnrichPending(db, calculationId);
    const calc = await db.calculation.findUnique({
      where: { id: calculationId },
      select: { aiDraft: true },
    });
    const draft = (calc?.aiDraft as Record<string, unknown> | null) || {};
    const withFails = appendLlmSoftFails(draft, [LLM_SOFT_FAIL.DRAIN_DEAD]);
    await db.calculation.update({
      where: { id: calculationId },
      data: {
        aiDraft: {
          ...withFails,
          llmEnrichPending: false,
          llmEnrich: withFails.llmEnrich || "unavailable",
          disclaimer:
            String(withFails.disclaimer || "") ||
            "AI-контур временно недоступен после нескольких попыток. Код предварительный (heuristic); финал — брокер.",
        },
      },
    });
  }

  logAiDrain({
    phase: willRequeue ? "drain-requeue" : "drain-dead",
    calculationId,
    jobId,
    attempt,
    ok: false,
    retriable,
    error: drain.error,
    delayMs: willRequeue ? delayMs : undefined,
  });

  return { ...drain, requeued: willRequeue, nextDelayMs: willRequeue ? delayMs : undefined };
}

/** Log-safe media pointer — never include image bytes. */
export function mediaUrlMeta(url?: string | null): {
  present: boolean;
  length?: number;
  suffix?: string;
  sha256?: string;
} {
  const raw = String(url || "").trim();
  if (!raw) return { present: false };
  return {
    present: true,
    length: raw.length,
    suffix: raw.slice(-32),
    sha256: createHash("sha256").update(raw).digest("hex").slice(0, 16),
  };
}

export type AiDrainResult = {
  ok: boolean;
  skipped?: boolean;
  /** Transport / provider outage — job should requeue with runAfter. */
  retriable?: boolean;
  requeued?: boolean;
  nextDelayMs?: number;
  visionDescription?: string | null;
  hsCode?: string | null;
  engine?: string;
  error?: string;
};

export async function runAiDrainPipeline(
  db: Db,
  opts: { calculationId: string; attempt?: number }
): Promise<AiDrainResult> {
  const attempt = Math.max(1, opts.attempt ?? 1);
  const chainId = resolveAiChainId();
  const visionMode = visionModeForChain(chainId);
  const classifyMode =
    classifyTransport() === "service" ? "service" : "direct-provider";
  const directVision = visionConfiguredForChain(chainId);
  const directLlm = classifyConfiguredForChain(chainId);
  if (!directVision && !directLlm) {
    return { ok: true, skipped: true };
  }
  logAiDrain({
    phase: "chain-select",
    calculationId: opts.calculationId,
    attempt,
    extra: {
      chainId,
      visionTransport: visionTransport(),
      classifyTransport: classifyTransport(),
    },
  });

  const calc = await db.calculation.findUnique({
    where: { id: opts.calculationId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!calc) {
    return { ok: false, error: "calculation not found" };
  }

  {
    const draft0 = (calc.aiDraft as Record<string, unknown> | null) || {};
    if (draft0.chainId !== chainId) {
      await db.calculation.update({
        where: { id: calc.id },
        data: { aiDraft: { ...draft0, chainId } as object },
      });
    }
  }

  const item = calc.items[0];
  const hint = [item?.name, calc.title, calc.description].filter(Boolean).join(" ").trim();
  let visionDescription: string | null = null;
  let describeFailed: string | null = null;
  const visionTimeoutMs = visionDescribeTimeoutMs();
  const mediaUrl =
    item?.mediaUrl && isAllowedMediaUrl(item.mediaUrl) ? item.mediaUrl : null;
  if (item?.mediaUrl && !mediaUrl) {
    logAiDrain({
      phase: "vision-skip",
      calculationId: calc.id,
      attempt,
      ok: false,
      error: "mediaUrl not allowlisted",
      extra: { media: mediaUrlMeta(item.mediaUrl) },
    });
  }
  const visionExpected = Boolean(mediaUrl) && directVision;
  let visionFetchMeta: Record<string, unknown> | undefined;

  if (visionExpected && mediaUrl) {
    logAiDrain({
      phase: "vision-start",
      calculationId: calc.id,
      attempt,
      extra: {
        mode: visionMode,
        timeoutMs: visionTimeoutMs,
        media: mediaUrlMeta(mediaUrl),
      },
    });
    await persistVisionTrace(db, calc.id, {
      phase: "vision-start",
      ok: true,
      mode: visionMode,
    });

    const describeCall = await recordServiceCall(db, {
      service: "ocr",
      operation: "describe",
      status: "PENDING",
      correlationId: calc.id,
      calculationId: calc.id,
      requestMeta: {
        media: mediaUrlMeta(mediaUrl),
        hint: hint.slice(0, 120),
        mode: visionMode,
        timeoutMs: visionTimeoutMs,
        chainId,
      },
      finished: false,
    });
    const t0 = Date.now();
    const visionSoftFail = visionSoftFailForChain(chainId);
    const { fail: visionFailPhase, ok: visionOkPhase } = visionPhasesForChain(chainId);
    try {
      const described = await describeForChain(chainId, {
        mediaUrl,
        hint,
        calculationId: calc.id,
      });
      visionFetchMeta = described.fetch
        ? {
            status: described.fetch.status,
            mime: described.fetch.mime,
            bytes: described.fetch.bytes,
            errorCode: described.fetch.errorCode,
          }
        : undefined;
      if (described.fetch) {
        await persistVisionTrace(db, calc.id, {
          phase: "vision-fetch",
          ok: described.fetch.ok,
          status: described.fetch.status,
          mime: described.fetch.mime,
          bytes: described.fetch.bytes,
          errorCode: described.fetch.errorCode,
          error: described.fetch.error,
          mode: visionMode,
        });
      }
      if (!described.ok || !described.description) {
        describeFailed = described.error || "vision describe empty";
        logAiDrain({
          phase: visionFailPhase,
          calculationId: calc.id,
          attempt,
          ok: false,
          error: describeFailed.slice(0, 200),
          extra: { mode: visionMode, status: described.qwenHttpStatus },
        });
        await persistVisionTrace(db, calc.id, {
          phase: visionFailPhase,
          ok: false,
          error: describeFailed.slice(0, 200),
          qwenHttpStatus: described.qwenHttpStatus,
          mode: visionMode,
        });
        await persistLlmSoftFails(db, calc.id, [visionSoftFail]);
        await completeServiceCall(db, describeCall.id, {
          status: described.qwenHttpStatus === 408 ? "TIMEOUT" : "FAILED",
          durationMs: Date.now() - t0,
          error: describeFailed.slice(0, 4000),
          responseMeta: {
            mode: visionMode,
            soft: true,
            fetch: visionFetchMeta,
            qwenHttpStatus: described.qwenHttpStatus,
            engine: described.engine,
            chainId,
            transport: described.transport,
          },
        });
      } else {
        visionDescription = described.description;
        logAiDrain({
          phase: visionOkPhase,
          calculationId: calc.id,
          attempt,
          ok: true,
          engine: String(described.engine || "ocr"),
          extra: { descriptionLen: visionDescription.length, mode: visionMode },
        });
        await persistVisionTrace(db, calc.id, {
          phase: visionOkPhase,
          ok: true,
          descriptionLen: visionDescription.length,
          qwenHttpStatus: described.qwenHttpStatus,
          mode: visionMode,
        });
        await completeServiceCall(db, describeCall.id, {
          status: "OK",
          durationMs: Date.now() - t0,
          responseMeta: {
            engine: described.engine,
            descriptionLen: visionDescription.length,
            mode: visionMode,
            fetch: visionFetchMeta,
            qwenHttpStatus: described.qwenHttpStatus,
            chainId,
            transport: described.transport,
          },
        });
        const fromVision = sanitizeProductAttrs(described.attrs);
        if (fromVision && item.id) {
          const merged = fillEmptyProductAttrs(item.attrs as ProductAttrs, fromVision);
          if (merged) {
            await db.calculationItem.update({
              where: { id: item.id },
              data: { attrs: merged as object },
            });
          }
        }
      }
    } catch (e) {
      describeFailed = e instanceof Error ? e.message : "vision describe failed";
      logAiDrain({
        phase: visionFailPhase,
        calculationId: calc.id,
        attempt,
        ok: false,
        error: describeFailed.slice(0, 200),
        extra: { mode: visionMode },
      });
      await persistVisionTrace(db, calc.id, {
        phase: visionFailPhase,
        ok: false,
        error: describeFailed.slice(0, 200),
        mode: visionMode,
      });
      await persistLlmSoftFails(db, calc.id, [visionSoftFail]);
      await completeServiceCall(db, describeCall.id, {
        status: classifyServiceError(e),
        durationMs: Date.now() - t0,
        error: describeFailed.slice(0, 4000),
        responseMeta: { mode: visionMode, chainId },
      });
    } finally {
      if (visionTransport() === "service") {
        const resetCall = await recordServiceCall(db, {
          service: "ocr",
          operation: "reset",
          status: "PENDING",
          correlationId: calc.id,
          calculationId: calc.id,
          requestMeta: { reason: "after_describe" },
          finished: false,
        });
        const tReset = Date.now();
        const reset = await resetOcrSessionForChain();
        if (!reset.ok && !reset.skipped) {
          await completeServiceCall(db, resetCall.id, {
            status: "FAILED",
            durationMs: Date.now() - tReset,
            error: String(reset.data.error || `ocr reset HTTP ${reset.status}`).slice(0, 4000),
            responseMeta: { engine: reset.data.engine },
          });
        } else {
          await completeServiceCall(db, resetCall.id, {
            status: "OK",
            durationMs: Date.now() - tReset,
            responseMeta: { engine: reset.data.engine, skipped: reset.skipped || reset.data.skipped },
          });
        }
      }
    }
  }

  // Wait for vision before classify when photo is present (requeue until last attempt).
  if (visionExpected && !visionDescription) {
    if (!aiDrainAllowClassifyWithoutVision({ attempt })) {
      logAiDrain({
        phase: "vision-wait",
        calculationId: calc.id,
        attempt,
        retriable: true,
        error: (describeFailed || "vision describe incomplete").slice(0, 200),
        extra: { timeoutMs: visionTimeoutMs, fetch: visionFetchMeta },
      });
      await persistVisionTrace(db, calc.id, {
        phase: "vision-wait",
        ok: false,
        error: (describeFailed || "vision describe incomplete").slice(0, 200),
      });
      return {
        ok: false,
        retriable: true,
        visionDescription: null,
        error: describeFailed || "vision describe incomplete — waiting before classify",
      };
    }
    logAiDrain({
      phase: "vision-skip-last-attempt",
      calculationId: calc.id,
      attempt,
      error: (describeFailed || "vision empty").slice(0, 200),
    });
    await persistVisionTrace(db, calc.id, {
      phase: "vision-skip-last-attempt",
      ok: false,
      error: (describeFailed || "vision empty").slice(0, 200),
    });
    await persistLlmSoftFails(db, calc.id, [visionSoftFailForChain(chainId)]);
  }

  if (!directLlm) {
    await clearLlmEnrichPending(db, calc.id);
    if (describeFailed) return { ok: false, visionDescription, error: describeFailed };
    return { ok: true, visionDescription, skipped: true, engine: "ocr-only" };
  }

  logAiDrain({
    phase: "classify-start",
    calculationId: calc.id,
    attempt,
    extra: {
      hasVision: Boolean(visionDescription),
      mode: classifyMode,
      timeoutMs: classifyTimeoutMs(),
      chainId,
    },
  });
  await persistVisionTrace(db, calc.id, {
    phase: "classify-start",
    ok: true,
    descriptionLen: visionDescription?.length,
    mode: classifyMode,
  });

  const classifyCall = await recordServiceCall(db, {
    service: "llm",
    operation: "classify",
    status: "PENDING",
    correlationId: calc.id,
    calculationId: calc.id,
    requestMeta: {
      hasVision: Boolean(visionDescription),
      title: calc.title?.slice(0, 80),
      mode: classifyMode,
      timeoutMs: classifyTimeoutMs(),
      chainId,
    },
    finished: false,
  });
  const tLlm = Date.now();
  try {
    const classified = await classifyForChain(db, chainId, {
      title: calc.title,
      description: calc.description || item?.description,
      name: item?.name,
      country: calc.country,
      visionDescription,
    });

    if (!classified.ok) {
      await completeServiceCall(db, classifyCall.id, {
        status: "FAILED",
        durationMs: Date.now() - tLlm,
        error: classified.error.slice(0, 4000),
        responseMeta: { transport: classified.transport, softMiss: classified.softMiss },
      });
      if (classified.softMiss) {
        await persistLlmSoftFails(db, calc.id, [LLM_SOFT_FAIL.CLASSIFY_CHAIN]);
        await clearLlmEnrichPending(db, calc.id);
        if (describeFailed) {
          return { ok: false, visionDescription, error: describeFailed, retriable: false };
        }
        return { ok: true, visionDescription, skipped: true, engine: "provider-miss", retriable: false };
      }
      return {
        ok: false,
        visionDescription,
        error: classified.error,
        retriable: classified.retriable,
      };
    }

    const hsCode = classified.hsCode;
    const engine = classified.engine;
    const corpusMiss = classified.corpusMiss;
    const confidence = classified.confidence;
    const disclaimer = classified.disclaimer;
    if (classified.softFails?.length) {
      await persistLlmSoftFails(db, calc.id, classified.softFails);
    }

    await completeServiceCall(db, classifyCall.id, {
      status: "OK",
      durationMs: Date.now() - tLlm,
      responseMeta: { engine, hsCode, corpusMiss, transport: classified.transport, chainId },
    });
    if (hsCode) {
      const digits = normalizeHsCode(hsCode);
      const fresh = await db.calculation.findUnique({
        where: { id: calc.id },
        select: { aiDraft: true, confidence: true },
      });
      const prev = (fresh?.aiDraft as Record<string, unknown> | null) || {};
      const { llmEnrichPending: _drop, ...rest } = prev;
      const nextConf =
        typeof confidence === "number"
          ? confidence
          : typeof fresh?.confidence === "number"
            ? fresh.confidence
            : typeof calc.confidence === "number"
              ? calc.confidence
              : undefined;
      const draftWithDisclaimer = {
        ...rest,
        ...(disclaimer ? { disclaimer } : {}),
      };
      // Keep existing llmSoftFails and re-attach test-mode notice onto model disclaimer
      const merged = appendLlmSoftFails(draftWithDisclaimer, []);
      await db.calculation.update({
        where: { id: calc.id },
        data: {
          hsCode,
          ...(nextConf != null ? { confidence: nextConf } : {}),
          aiDraft: {
            ...merged,
            hsCode,
            ...(nextConf != null ? { confidence: nextConf } : {}),
            llmEnrich: engine,
            llmEnrichPending: false,
            chainId,
            ...(visionDescription
              ? { visionDescription: visionDescription.slice(0, 2000) }
              : {}),
          },
        },
      });
      if (item?.id) {
        await db.calculationItem.update({
          where: { id: item.id },
          data: { hsCodeAi: hsCode, tnvedCode: digits },
        });
      }
    } else {
      await clearLlmEnrichPending(db, calc.id);
    }
    return {
      ok: true,
      visionDescription,
      hsCode,
      engine,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : "llm classify failed";
    await completeServiceCall(db, classifyCall.id, {
      status: classifyServiceError(e),
      durationMs: Date.now() - tLlm,
      error: err.slice(0, 4000),
    });
    const retriable = classifyServiceError(e) === "TIMEOUT" || /503|502|429|fetch|network/i.test(err);
    return { ok: false, visionDescription, error: err, retriable };
  }
}
