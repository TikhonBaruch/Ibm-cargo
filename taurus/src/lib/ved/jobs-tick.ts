/**
 * Vercel Pro cron tick: SLA + outbox drain + claim/run AI_DRAIN (Compose worker substitute).
 */
import type { PrismaClient } from "@prisma/client";
import { finishQueuedAiDrainForCalc } from "./ai-pipeline";
import { runSlaTick } from "./calculations";
import { claimBackgroundJobs, finishBackgroundJob } from "./orchestration";
import { drainServiceOutbox } from "./outbox-drain";

export type JobsTickResult = {
  sla: Awaited<ReturnType<typeof runSlaTick>>;
  outbox: Awaited<ReturnType<typeof drainServiceOutbox>>;
  aiDrain: {
    claimed: number;
    results: Array<{ id: string; ok: boolean; error?: string; requeued?: boolean }>;
  };
  outboxJobsFinished: number;
};

export async function runJobsTick(
  db: PrismaClient,
  opts: { lockedBy?: string; outboxLimit?: number; aiLimit?: number } = {}
): Promise<JobsTickResult> {
  const lockedBy = opts.lockedBy || `vercel-cron-${Date.now().toString(36)}`;

  const sla = await runSlaTick({ actorUserId: "worker" });
  const outbox = await drainServiceOutbox(db, { limit: opts.outboxLimit ?? 20 });

  const outboxJobs = await claimBackgroundJobs(db, {
    lockedBy,
    limit: 5,
    kinds: ["OUTBOX_DRAIN"],
  });
  for (const job of outboxJobs) {
    await finishBackgroundJob(db, job.id, {
      ok: true,
      result: outbox as unknown as Record<string, unknown>,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    });
  }

  const aiJobs = await claimBackgroundJobs(db, {
    lockedBy,
    limit: opts.aiLimit ?? 3,
    kinds: ["AI_DRAIN"],
  });
  const aiResults: Array<{ id: string; ok: boolean; error?: string; requeued?: boolean }> = [];
  for (const job of aiJobs) {
    const payload =
      job.payload && typeof job.payload === "object"
        ? (job.payload as Record<string, unknown>)
        : {};
    const calculationId = String(job.calculationId || payload.calculationId || "").trim();
    if (!calculationId) {
      await finishBackgroundJob(db, job.id, {
        ok: false,
        error: "AI_DRAIN missing calculationId",
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
      });
      aiResults.push({ id: job.id, ok: false, error: "missing calculationId" });
      continue;
    }
    // Shared path with after(): requeue table + pending semantics
    const run = await finishQueuedAiDrainForCalc(db, calculationId);
    const ok = Boolean(run.ok && run.hsCode);
    aiResults.push({
      id: job.id,
      ok,
      error: ok ? undefined : run.error || "ai-drain failed",
      requeued: run.requeued,
    });
  }

  return {
    sla,
    outbox,
    aiDrain: { claimed: aiJobs.length, results: aiResults },
    outboxJobsFinished: outboxJobs.length,
  };
}
