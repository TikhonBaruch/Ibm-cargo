/**
 * Durable orchestration helpers (D26): outbox, background jobs, service call journal.
 * Does not replace Calculation / PaymentIntent / Shipping status machines.
 */
import { Prisma, type PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export const OUTBOX_TEMPLATES = [
  "generic",
  "calc.approved",
  "calc.sla_risk",
  "ledger.topup",
] as const;

export type OutboxTemplate = (typeof OUTBOX_TEMPLATES)[number];

export const JOB_KINDS = [
  "SLA_TICK",
  "OUTBOX_DRAIN",
  "AI_DRAIN",
  "LEDGER_RECONCILE",
  "LOGISTICS_TRACK",
] as const;

export type JobKind = (typeof JOB_KINDS)[number];

/** Map fetch/Abort failures to ServiceCall terminal status. */
export function classifyServiceError(err: unknown): "FAILED" | "TIMEOUT" {
  if (err && typeof err === "object") {
    const name = "name" in err ? String((err as { name?: string }).name) : "";
    const msg = "message" in err ? String((err as { message?: string }).message).toLowerCase() : "";
    if (
      name === "TimeoutError" ||
      name === "AbortError" ||
      msg.includes("timeout") ||
      msg.includes("aborted") ||
      msg.includes("timed out")
    ) {
      return "TIMEOUT";
    }
  }
  return "FAILED";
}

export async function enqueueOutbox(
  db: Db,
  opts: {
    channel?: string;
    template: OutboxTemplate | string;
    to: string;
    payload?: Record<string, unknown>;
    calculationId?: string | null;
    paymentIntentId?: string | null;
    companyId?: string | null;
    ledgerEntryId?: string | null;
  }
) {
  return db.serviceOutbox.create({
    data: {
      channel: opts.channel || "email",
      template: opts.template,
      to: opts.to,
      payload: (opts.payload ?? {}) as Prisma.InputJsonValue,
      status: "PENDING",
      calculationId: opts.calculationId || undefined,
      paymentIntentId: opts.paymentIntentId || undefined,
      companyId: opts.companyId || undefined,
      ledgerEntryId: opts.ledgerEntryId || undefined,
    },
  });
}

export async function enqueueBackgroundJob(
  db: Db,
  opts: {
    kind: JobKind | string;
    payload?: Record<string, unknown>;
    runAfter?: Date;
    maxAttempts?: number;
    calculationId?: string | null;
    paymentIntentId?: string | null;
  }
) {
  return db.backgroundJob.create({
    data: {
      kind: opts.kind,
      payload: (opts.payload ?? {}) as Prisma.InputJsonValue,
      status: "QUEUED",
      runAfter: opts.runAfter || new Date(),
      maxAttempts: opts.maxAttempts ?? 5,
      calculationId: opts.calculationId || undefined,
      paymentIntentId: opts.paymentIntentId || undefined,
    },
  });
}

export async function recordServiceCall(
  db: Db,
  opts: {
    service: string;
    operation: string;
    status?: "PENDING" | "OK" | "FAILED" | "TIMEOUT";
    correlationId?: string | null;
    requestMeta?: Record<string, unknown>;
    responseMeta?: Record<string, unknown>;
    durationMs?: number;
    error?: string | null;
    calculationId?: string | null;
    paymentIntentId?: string | null;
    shippingRequestId?: string | null;
    finished?: boolean;
  }
) {
  const finished = opts.finished ?? opts.status !== "PENDING";
  return db.serviceCall.create({
    data: {
      service: opts.service,
      operation: opts.operation,
      status: opts.status || "PENDING",
      correlationId: opts.correlationId || undefined,
      requestMeta: (opts.requestMeta ?? undefined) as Prisma.InputJsonValue | undefined,
      responseMeta: (opts.responseMeta ?? undefined) as Prisma.InputJsonValue | undefined,
      durationMs: opts.durationMs,
      error: opts.error || undefined,
      calculationId: opts.calculationId || undefined,
      paymentIntentId: opts.paymentIntentId || undefined,
      shippingRequestId: opts.shippingRequestId || undefined,
      finishedAt: finished ? new Date() : undefined,
    },
  });
}

export async function completeServiceCall(
  db: Db,
  id: string,
  opts: {
    status: "OK" | "FAILED" | "TIMEOUT";
    responseMeta?: Record<string, unknown>;
    durationMs?: number;
    error?: string | null;
  }
) {
  return db.serviceCall.update({
    where: { id },
    data: {
      status: opts.status,
      responseMeta: (opts.responseMeta ?? undefined) as Prisma.InputJsonValue | undefined,
      durationMs: opts.durationMs,
      error: opts.error || undefined,
      finishedAt: new Date(),
    },
  });
}

/** Claim next QUEUED jobs ready to run (Postgres lease). */
export async function claimBackgroundJobs(
  db: PrismaClient,
  opts: { lockedBy: string; limit?: number; kinds?: string[] }
) {
  const limit = opts.limit ?? 5;
  const now = new Date();
  const candidates = await db.backgroundJob.findMany({
    where: {
      status: "QUEUED",
      runAfter: { lte: now },
      ...(opts.kinds?.length ? { kind: { in: opts.kinds } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit * 3,
  });

  const claimed = [];
  for (const row of candidates) {
    if (claimed.length >= limit) break;
    const updated = await db.backgroundJob.updateMany({
      where: { id: row.id, status: "QUEUED" },
      data: {
        status: "RUNNING",
        lockedAt: now,
        lockedBy: opts.lockedBy,
        attempts: { increment: 1 },
      },
    });
    if (updated.count === 1) {
      const job = await db.backgroundJob.findUnique({ where: { id: row.id } });
      if (job) claimed.push(job);
    }
  }
  return claimed;
}

/** Admin force-requeue FAILED/DEAD background job. */
export async function retryBackgroundJob(db: Db, id: string) {
  const job = await db.backgroundJob.findUnique({ where: { id } });
  if (!job) {
    const err = new Error("Job not found");
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  if (job.status !== "FAILED" && job.status !== "DEAD") {
    const err = new Error(`Cannot retry job in status ${job.status}`);
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  return db.backgroundJob.update({
    where: { id },
    data: {
      status: "QUEUED",
      attempts: 0,
      lastError: null,
      lockedAt: null,
      lockedBy: null,
      finishedAt: null,
      runAfter: new Date(),
      result: Prisma.DbNull,
    },
  });
}

/** Admin force-requeue FAILED/DEAD outbox row (+ kick OUTBOX_DRAIN). */
export async function retryOutboxMessage(db: Db, id: string) {
  const row = await db.serviceOutbox.findUnique({ where: { id } });
  if (!row) {
    const err = new Error("Outbox message not found");
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  if (row.status !== "FAILED" && row.status !== "DEAD") {
    const err = new Error(`Cannot retry outbox in status ${row.status}`);
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  const updated = await db.serviceOutbox.update({
    where: { id },
    data: {
      status: "PENDING",
      attempts: 0,
      lastError: null,
      nextAttemptAt: new Date(),
      deliveredAt: null,
    },
  });
  await enqueueBackgroundJob(db, {
    kind: "OUTBOX_DRAIN",
    payload: { reason: "admin_retry", outboxId: id },
    maxAttempts: 3,
  });
  return updated;
}

export async function finishBackgroundJob(
  db: Db,
  id: string,
  opts: {
    ok: boolean;
    result?: Record<string, unknown>;
    error?: string | null;
    maxAttempts?: number;
    attempts?: number;
    /** Override default attempts×30s backoff (AI_DRAIN staggered table). */
    retryDelayMs?: number;
  }
) {
  if (opts.ok) {
    return db.backgroundJob.update({
      where: { id },
      data: {
        status: "DONE",
        result: (opts.result ?? undefined) as Prisma.InputJsonValue | undefined,
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
  }
  const attempts = opts.attempts ?? 1;
  const maxAttempts = opts.maxAttempts ?? 5;
  const dead = attempts >= maxAttempts;
  const delay =
    opts.retryDelayMs ?? Math.min(attempts, 10) * 30_000;
  return db.backgroundJob.update({
    where: { id },
    data: {
      status: dead ? "DEAD" : "QUEUED",
      lastError: opts.error || "failed",
      runAfter: dead ? undefined : new Date(Date.now() + delay),
      lockedAt: null,
      lockedBy: null,
      finishedAt: dead ? new Date() : undefined,
    },
  });
}

/** Claim PENDING outbox rows for sending. */
export async function claimOutboxBatch(db: PrismaClient, opts: { limit?: number } = {}) {
  const limit = opts.limit ?? 20;
  const now = new Date();
  const candidates = await db.serviceOutbox.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      nextAttemptAt: { lte: now },
    },
    orderBy: { createdAt: "asc" },
    take: limit * 2,
  });

  const claimed = [];
  for (const row of candidates) {
    if (claimed.length >= limit) break;
    const updated = await db.serviceOutbox.updateMany({
      where: { id: row.id, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "SENDING", attempts: { increment: 1 } },
    });
    if (updated.count === 1) {
      const msg = await db.serviceOutbox.findUnique({ where: { id: row.id } });
      if (msg) claimed.push(msg);
    }
  }
  return claimed;
}

export async function markOutboxDelivered(db: Db, id: string) {
  return db.serviceOutbox.update({
    where: { id },
    data: { status: "DELIVERED", deliveredAt: new Date(), lastError: null },
  });
}

export async function markOutboxFailed(db: Db, id: string, error: string, attempts: number) {
  const dead = attempts >= 5;
  return db.serviceOutbox.update({
    where: { id },
    data: {
      status: dead ? "DEAD" : "FAILED",
      lastError: error.slice(0, 2000),
      nextAttemptAt: dead ? undefined : new Date(Date.now() + Math.min(attempts, 10) * 60_000),
    },
  });
}

/** Best-effort kick notify after durable enqueue (does not replace outbox). */
export async function kickNotifyDelivery(msg: {
  channel?: string;
  template: string;
  to: string;
  payload?: Record<string, unknown>;
  outboxId?: string;
}) {
  try {
    const { getPlatformSettings } = await import("./settings");
    const settings = await getPlatformSettings();
    if (settings.notifyEnabled === false) return;
  } catch {
    /* settings unavailable — continue best-effort */
  }

  const notifyUrl = (process.env.NOTIFY_SERVICE_URL || "").replace(/\/$/, "");
  if (notifyUrl) {
    void fetch(`${notifyUrl}/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: msg.channel || "email",
        template: msg.template,
        to: msg.to,
        payload: { ...(msg.payload || {}), outboxId: msg.outboxId },
      }),
    }).catch(() => undefined);
    return;
  }
  // Vercel / no notify container: Resend inline (F17)
  const { sendInlineEmail, canSendInlineEmail } = await import("./notify-email");
  if (!canSendInlineEmail()) return;
  void sendInlineEmail({
    to: msg.to,
    template: msg.template,
    payload: msg.payload,
  })
    .then(async (r) => {
      if (r.ok && msg.outboxId && !r.skipped) {
        try {
          const { prisma } = await import("@/lib/prisma");
          await markOutboxDelivered(prisma, msg.outboxId);
        } catch {
          /* best-effort */
        }
      }
    })
    .catch(() => undefined);
}
