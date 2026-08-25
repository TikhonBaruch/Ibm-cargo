/**
 * Orchestration health snapshot (D26): recent ServiceCall stats + dependency /health probes.
 */
import type { PrismaClient } from "@prisma/client";

export type DepHealth = {
  service: string;
  configured: boolean;
  ok: boolean | null;
  latencyMs?: number;
  error?: string;
  statusCode?: number;
};

export type OrchHealth = {
  ok: boolean;
  windowMinutes: number;
  since: string;
  calls: {
    total: number;
    byStatus: Record<string, number>;
    byService: Record<
      string,
      {
        total: number;
        ok: number;
        failed: number;
        timeout: number;
        pending: number;
        avgDurationMs: number | null;
      }
    >;
    recentFailures: Array<{
      id: string;
      service: string;
      operation: string;
      status: string;
      error: string | null;
      durationMs: number | null;
      createdAt: string;
    }>;
  };
  outbox: { pending: number; sending: number; failed: number; dead: number };
  deps: DepHealth[];
};

async function probeHealth(service: string, baseUrl: string | undefined): Promise<DepHealth> {
  const url = (baseUrl || "").replace(/\/$/, "");
  if (!url) {
    return { service, configured: false, ok: null };
  }
  const t0 = Date.now();
  try {
    const res = await fetch(`${url}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(Number(process.env.ORCH_HEALTH_PROBE_MS || 2500)),
    });
    return {
      service,
      configured: true,
      ok: res.ok,
      latencyMs: Date.now() - t0,
      statusCode: res.status,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      service,
      configured: true,
      ok: false,
      latencyMs: Date.now() - t0,
      error: e instanceof Error ? e.message : "probe failed",
    };
  }
}

export async function getOrchestrationHealth(
  db: PrismaClient,
  opts: { windowMinutes?: number } = {}
): Promise<OrchHealth> {
  const windowMinutes = Math.min(Math.max(opts.windowMinutes ?? 15, 1), 180);
  const since = new Date(Date.now() - windowMinutes * 60_000);

  const [calls, outboxGroups] = await Promise.all([
    db.serviceCall.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        service: true,
        operation: true,
        status: true,
        error: true,
        durationMs: true,
        createdAt: true,
      },
    }),
    db.serviceOutbox.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { status: { in: ["PENDING", "SENDING", "FAILED", "DEAD"] } },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  const durationAcc: Record<string, { sum: number; n: number }> = {};
  const byService: OrchHealth["calls"]["byService"] = {};

  for (const c of calls) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    if (!byService[c.service]) {
      byService[c.service] = {
        total: 0,
        ok: 0,
        failed: 0,
        timeout: 0,
        pending: 0,
        avgDurationMs: null,
      };
      durationAcc[c.service] = { sum: 0, n: 0 };
    }
    const b = byService[c.service];
    b.total += 1;
    if (c.status === "OK") b.ok += 1;
    else if (c.status === "FAILED") b.failed += 1;
    else if (c.status === "TIMEOUT") b.timeout += 1;
    else if (c.status === "PENDING") b.pending += 1;
    if (typeof c.durationMs === "number") {
      durationAcc[c.service].sum += c.durationMs;
      durationAcc[c.service].n += 1;
    }
  }

  for (const [svc, b] of Object.entries(byService)) {
    const acc = durationAcc[svc];
    b.avgDurationMs = acc && acc.n > 0 ? Math.round(acc.sum / acc.n) : null;
  }

  const outbox = { pending: 0, sending: 0, failed: 0, dead: 0 };
  for (const g of outboxGroups) {
    const n = g._count._all;
    if (g.status === "PENDING") outbox.pending = n;
    else if (g.status === "SENDING") outbox.sending = n;
    else if (g.status === "FAILED") outbox.failed = n;
    else if (g.status === "DEAD") outbox.dead = n;
  }

  const deps = await Promise.all([
    probeHealth("payments", process.env.PAYMENTS_SERVICE_URL),
    probeHealth("llm", process.env.LLM_SERVICE_URL),
    probeHealth("ai", process.env.AI_SERVICE_URL || process.env.AI_URL),
    probeHealth("notify", process.env.NOTIFY_SERVICE_URL),
    probeHealth("logistics", process.env.LOGISTICS_SERVICE_URL),
    probeHealth("ocr", process.env.OCR_SERVICE_URL),
  ]);

  const failedCalls = (byStatus.FAILED || 0) + (byStatus.TIMEOUT || 0);
  const total = calls.length;
  const failureRateHigh = total >= 5 && failedCalls / total >= 0.35;
  const spikeFailures = failedCalls >= 5;
  const depDown = deps.some((d) => d.configured && d.ok === false);
  const outboxBacklog = outbox.dead > 0 || outbox.failed >= 10;

  const recentFailures = calls
    .filter((c) => c.status === "FAILED" || c.status === "TIMEOUT")
    .slice(0, 10)
    .map((c) => ({
      id: c.id,
      service: c.service,
      operation: c.operation,
      status: c.status,
      error: c.error,
      durationMs: c.durationMs,
      createdAt: c.createdAt.toISOString(),
    }));

  return {
    ok: !depDown && !failureRateHigh && !spikeFailures && !outboxBacklog,
    windowMinutes,
    since: since.toISOString(),
    calls: {
      total,
      byStatus,
      byService,
      recentFailures,
    },
    outbox,
    deps,
  };
}
