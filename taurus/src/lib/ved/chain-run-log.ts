/**
 * Analyzable AI chain journal (no secrets / no image bytes).
 * Stored on Calculation.aiDraft.chainRun; also returned by GET …/chain-log.
 */

export const CHAIN_RUN_VERSION = 1 as const;

export type ChainRunStep = {
  ts: string;
  phase: string;
  ok?: boolean;
  ms?: number;
  provider?: string;
  error?: string;
  detail?: Record<string, unknown>;
};

export type ChainRunResult = {
  ok: boolean;
  hsCode?: string | null;
  engine?: string;
  confidence?: number;
  pending?: boolean;
  error?: string;
  softFails?: string[];
};

export type ChainRunLog = {
  version: typeof CHAIN_RUN_VERSION;
  startedAt: string;
  finishedAt?: string;
  chainId?: number;
  attempt?: number;
  visionTransport?: "service" | "mesh" | string;
  classifyTransport?: "service" | "mesh" | string;
  steps: ChainRunStep[];
  result?: ChainRunResult;
};

export type ServiceCallSlice = {
  id?: string;
  service: string;
  operation: string;
  status: string;
  durationMs?: number | null;
  error?: string | null;
  createdAt?: string | Date;
  finishedAt?: string | Date | null;
  requestMeta?: unknown;
  responseMeta?: unknown;
};

export type ChainAnalysis = {
  calculationId: string;
  number?: string;
  status?: string;
  hsCode?: string | null;
  confidence?: number | null;
  pending: boolean;
  chainId?: number;
  llmEnrich?: string;
  engine?: string;
  softFails?: string[];
  visionTrace?: unknown[];
  chainRun?: ChainRunLog | null;
  serviceCalls: Array<{
    service: string;
    operation: string;
    status: string;
    durationMs?: number | null;
    error?: string | null;
    responseMeta?: unknown;
  }>;
  timeline: Array<{ t: string; kind: string; summary: string }>;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function readChainRun(draft: unknown): ChainRunLog | null {
  const d = asRecord(draft);
  const raw = d?.chainRun;
  const cr = asRecord(raw);
  if (!cr || cr.version !== CHAIN_RUN_VERSION) return null;
  return raw as ChainRunLog;
}

export function startChainRun(opts: {
  chainId?: number;
  attempt?: number;
  visionTransport?: string;
  classifyTransport?: string;
  startedAt?: string;
}): ChainRunLog {
  return {
    version: CHAIN_RUN_VERSION,
    startedAt: opts.startedAt || new Date().toISOString(),
    chainId: opts.chainId,
    attempt: opts.attempt,
    visionTransport: opts.visionTransport,
    classifyTransport: opts.classifyTransport,
    steps: [],
  };
}

export function appendChainRunStep(
  log: ChainRunLog,
  step: Omit<ChainRunStep, "ts"> & { ts?: string }
): ChainRunLog {
  const next: ChainRunStep = {
    ts: step.ts || new Date().toISOString(),
    phase: step.phase,
    ...(step.ok != null ? { ok: step.ok } : {}),
    ...(step.ms != null ? { ms: step.ms } : {}),
    ...(step.provider ? { provider: step.provider } : {}),
    ...(step.error ? { error: String(step.error).slice(0, 240) } : {}),
    ...(step.detail ? { detail: step.detail } : {}),
  };
  return {
    ...log,
    steps: [...(log.steps || []), next].slice(-24),
  };
}

export function finishChainRun(
  log: ChainRunLog,
  result: ChainRunResult,
  finishedAt?: string
): ChainRunLog {
  return {
    ...log,
    finishedAt: finishedAt || new Date().toISOString(),
    result,
  };
}

export function mergeChainRunIntoDraft(
  draft: Record<string, unknown> | null | undefined,
  chainRun: ChainRunLog
): Record<string, unknown> {
  return { ...(draft || {}), chainRun };
}

/**
 * Client/ops analysis view from calc + optional ServiceCall rows.
 * Safe for JSONL / admin UI (strips request bodies beyond meta already stored).
 */
export function analyzeCalcChain(input: {
  id: string;
  number?: string | null;
  status?: string | null;
  hsCode?: string | null;
  confidence?: number | null;
  aiDrainPending?: boolean;
  aiDraft?: unknown;
  serviceCalls?: ServiceCallSlice[];
}): ChainAnalysis {
  const draft = asRecord(input.aiDraft) || {};
  const pending =
    input.aiDrainPending === true || draft.llmEnrichPending === true;
  const chainRun = readChainRun(draft);
  const visionTrace = Array.isArray(draft.visionTrace) ? draft.visionTrace : undefined;
  const softFails = Array.isArray(draft.llmSoftFails)
    ? draft.llmSoftFails.map(String)
    : undefined;

  const calls = (input.serviceCalls || []).map((c) => ({
    service: c.service,
    operation: c.operation,
    status: c.status,
    durationMs: c.durationMs,
    error: c.error ? String(c.error).slice(0, 240) : null,
    responseMeta: c.responseMeta,
  }));

  const timeline: ChainAnalysis["timeline"] = [];
  if (chainRun?.startedAt) {
    timeline.push({
      t: chainRun.startedAt,
      kind: "drain-start",
      summary: `chain=${chainRun.chainId ?? "?"} attempt=${chainRun.attempt ?? "?"}`,
    });
  }
  for (const s of chainRun?.steps || []) {
    timeline.push({
      t: s.ts,
      kind: s.phase,
      summary: [
        s.ok == null ? "" : s.ok ? "ok" : "fail",
        s.ms != null ? `${s.ms}ms` : "",
        s.provider || "",
        s.error || "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  }
  for (const c of calls) {
    timeline.push({
      t: typeof c.responseMeta === "object" ? "" : "",
      kind: `svc:${c.service}/${c.operation}`,
      summary: `${c.status}${c.durationMs != null ? ` ${c.durationMs}ms` : ""}${
        c.error ? ` ${c.error}` : ""
      }`,
    });
  }
  if (visionTrace) {
    for (const raw of visionTrace) {
      const e = asRecord(raw);
      if (!e) continue;
      timeline.push({
        t: String(e.ts || ""),
        kind: `vision:${e.phase || "?"}`,
        summary: [
          e.ok == null ? "" : e.ok ? "ok" : "fail",
          e.mode || "",
          e.error || e.errorCode || "",
        ]
          .filter(Boolean)
          .join(" "),
      });
    }
  }

  timeline.sort((a, b) => String(a.t).localeCompare(String(b.t)));

  return {
    calculationId: input.id,
    number: input.number || undefined,
    status: input.status || undefined,
    hsCode: (input.hsCode as string | null) || (draft.hsCode as string | null) || null,
    confidence:
      typeof input.confidence === "number"
        ? input.confidence
        : typeof draft.confidence === "number"
          ? draft.confidence
          : null,
    pending,
    chainId: typeof draft.chainId === "number" ? draft.chainId : chainRun?.chainId,
    llmEnrich: typeof draft.llmEnrich === "string" ? draft.llmEnrich : undefined,
    engine: typeof draft.engine === "string" ? draft.engine : chainRun?.result?.engine,
    ...(softFails?.length ? { softFails } : {}),
    visionTrace,
    chainRun,
    serviceCalls: calls,
    timeline,
  };
}

/**
 * Build a durable chainRun snapshot from draft traces + ServiceCall rows + drain result.
 */
export function buildChainRunSnapshot(input: {
  draft?: Record<string, unknown> | null;
  attempt?: number;
  visionTransport?: string;
  classifyTransport?: string;
  serviceCalls?: ServiceCallSlice[];
  result: ChainRunResult;
  startedAt?: string;
}): ChainRunLog {
  const draft = input.draft || {};
  const chainId = typeof draft.chainId === "number" ? draft.chainId : undefined;
  let log = startChainRun({
    chainId,
    attempt: input.attempt,
    visionTransport: input.visionTransport,
    classifyTransport: input.classifyTransport,
    startedAt: input.startedAt,
  });

  const visionTrace = Array.isArray(draft.visionTrace) ? draft.visionTrace : [];
  for (const raw of visionTrace) {
    const e = asRecord(raw);
    if (!e) continue;
    log = appendChainRunStep(log, {
      ts: typeof e.ts === "string" ? e.ts : undefined,
      phase: `vision:${String(e.phase || "step")}`,
      ok: typeof e.ok === "boolean" ? e.ok : undefined,
      provider: typeof e.mode === "string" ? e.mode : undefined,
      error: e.error ? String(e.error) : e.errorCode ? String(e.errorCode) : undefined,
      detail: {
        ...(typeof e.descriptionLen === "number" ? { descriptionLen: e.descriptionLen } : {}),
        ...(typeof e.qwenHttpStatus === "number" ? { http: e.qwenHttpStatus } : {}),
      },
    });
  }

  for (const c of input.serviceCalls || []) {
    const created =
      c.createdAt instanceof Date
        ? c.createdAt.toISOString()
        : typeof c.createdAt === "string"
          ? c.createdAt
          : undefined;
    log = appendChainRunStep(log, {
      ts: created,
      phase: `svc:${c.service}/${c.operation}`,
      ok: c.status === "OK",
      ms: c.durationMs ?? undefined,
      error: c.error ? String(c.error) : undefined,
      detail: c.responseMeta && typeof c.responseMeta === "object" ? (c.responseMeta as Record<string, unknown>) : undefined,
    });
  }

  return finishChainRun(log, input.result);
}
