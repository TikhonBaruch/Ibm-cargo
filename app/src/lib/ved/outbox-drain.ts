/**
 * Drain ServiceOutbox → notify service or inline Resend; mark DELIVERED / FAILED (D26 / F17).
 * Without RESEND_API_KEY / NOTIFY_SERVICE_URL do **not** fake DELIVERED.
 */
import type { PrismaClient } from "@prisma/client";
import {
  claimOutboxBatch,
  markOutboxDelivered,
  markOutboxFailed,
  recordServiceCall,
} from "./orchestration";
import { canSendInlineEmail, sendInlineEmail } from "./notify-email";

function notifyAcceptedDelivery(body: {
  status?: string;
  deliveryStatus?: string;
  delivery?: { skipped?: boolean };
}): boolean {
  if (body.delivery?.skipped) return false;
  if (body.status === "queued" || body.deliveryStatus === "PENDING") return false;
  return body.status === "delivered" || body.deliveryStatus === "DELIVERED";
}

export type OutboxDrainResult = {
  claimed: number;
  delivered: number;
  failed: number;
};

export async function drainServiceOutbox(
  db: PrismaClient,
  opts: { limit?: number } = {}
): Promise<OutboxDrainResult> {
  const limit = Number(opts.limit) || 20;
  const notifyUrl = (process.env.NOTIFY_SERVICE_URL || "").replace(/\/$/, "");
  const batch = await claimOutboxBatch(db, { limit });
  let delivered = 0;
  let failed = 0;

  for (const msg of batch) {
    const t0 = Date.now();
    const call = await recordServiceCall(db, {
      service: "notify",
      operation: "send",
      status: "PENDING",
      correlationId: msg.id,
      calculationId: msg.calculationId,
      paymentIntentId: msg.paymentIntentId,
      requestMeta: { template: msg.template, to: msg.to },
      finished: false,
    });

    if (!notifyUrl) {
      if (!canSendInlineEmail()) {
        const err = "no NOTIFY_SERVICE_URL and no RESEND_API_KEY";
        await markOutboxFailed(db, msg.id, err, msg.attempts);
        await db.serviceCall.update({
          where: { id: call.id },
          data: {
            status: "FAILED",
            error: err,
            durationMs: Date.now() - t0,
            finishedAt: new Date(),
          },
        });
        failed += 1;
        continue;
      }
      try {
        const r = await sendInlineEmail({
          to: msg.to,
          template: msg.template,
          payload:
            typeof msg.payload === "object" && msg.payload
              ? (msg.payload as Record<string, unknown>)
              : undefined,
        });
        if (!r.ok || r.skipped) {
          throw new Error(r.error || "inline email skipped");
        }
        await markOutboxDelivered(db, msg.id);
        await db.serviceCall.update({
          where: { id: call.id },
          data: {
            status: "OK",
            durationMs: Date.now() - t0,
            responseMeta: { mode: "inline-resend" },
            finishedAt: new Date(),
          },
        });
        delivered += 1;
      } catch (e) {
        const err = e instanceof Error ? e.message : "inline send failed";
        await markOutboxFailed(db, msg.id, err, msg.attempts);
        await db.serviceCall.update({
          where: { id: call.id },
          data: {
            status: "FAILED",
            error: err,
            durationMs: Date.now() - t0,
            finishedAt: new Date(),
          },
        });
        failed += 1;
      }
      continue;
    }

    try {
      const res = await fetch(`${notifyUrl}/v1/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: msg.channel,
          template: msg.template,
          to: msg.to,
          payload: {
            ...(typeof msg.payload === "object" && msg.payload ? msg.payload : {}),
            outboxId: msg.id,
          },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`notify ${res.status} ${text.slice(0, 200)}`);
      }
      const payload = (await res.json().catch(() => ({}))) as {
        status?: string;
        deliveryStatus?: string;
        delivery?: { skipped?: boolean };
      };
      if (!notifyAcceptedDelivery(payload)) {
        throw new Error(
          payload.delivery?.skipped
            ? `notify skipped: ${JSON.stringify(payload.delivery).slice(0, 120)}`
            : "notify did not confirm delivery"
        );
      }
      await markOutboxDelivered(db, msg.id);
      await db.serviceCall.update({
        where: { id: call.id },
        data: {
          status: "OK",
          durationMs: Date.now() - t0,
          finishedAt: new Date(),
        },
      });
      delivered += 1;
    } catch (e) {
      const err = e instanceof Error ? e.message : "send failed";
      await markOutboxFailed(db, msg.id, err, msg.attempts);
      await db.serviceCall.update({
        where: { id: call.id },
        data: {
          status: "FAILED",
          error: err,
          durationMs: Date.now() - t0,
          finishedAt: new Date(),
        },
      });
      failed += 1;
    }
  }

  return { claimed: batch.length, delivered, failed };
}
