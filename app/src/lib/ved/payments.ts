/**
 * Company topup: prefer containers/payments checkout, else mock creditCompany (D13).
 * Durable PaymentIntent rows; YooKassa pending until provider webhook TOPUP.
 * Mock path gated: ALLOW_MOCK_TOPUP / DEMO_MODE, or non-production runtime.
 */
import { prisma } from "@/lib/prisma";
import { creditCompany } from "@/lib/ved/ledger";
import {
  classifyServiceError,
  completeServiceCall,
  enqueueOutbox,
  kickNotifyDelivery,
  recordServiceCall,
} from "@/lib/ved/orchestration";
import { assertPaymentsEnabled, isMockTopupAllowedBySettings } from "@/lib/ved/platform-gates";

export type TopupResult = {
  entry: unknown;
  company: unknown;
  provider: "payments-stub" | "yookassa" | "mock";
  intentId?: string | null;
  pending?: boolean;
  confirmUrl?: string | null;
};

/** Whether free mock ledger topup is allowed (demo / local only by default). Env-only gate. */
export function isMockTopupAllowed(): boolean {
  const flag = (process.env.ALLOW_MOCK_TOPUP || "").toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  if ((process.env.DEMO_MODE || "").toLowerCase() === "1") return true;
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    return false;
  }
  return true;
}

export async function topupViaPaymentsOrMock(opts: {
  companyId: string;
  amountRub: number;
  userId?: string;
  method?: string;
}): Promise<TopupResult> {
  await assertPaymentsEnabled();

  const base = (process.env.PAYMENTS_SERVICE_URL || "").replace(/\/$/, "");
  const method = opts.method && opts.method !== "mock" ? opts.method : "stub";

  if (base) {
    const intentRow = await prisma.paymentIntent.create({
      data: {
        companyId: opts.companyId,
        userId: opts.userId || null,
        amountRub: opts.amountRub,
        method,
        provider: "stub",
        status: "PENDING",
      },
    });

    const payCall = await recordServiceCall(prisma, {
      service: "payments",
      operation: "checkout",
      status: "PENDING",
      correlationId: intentRow.id,
      paymentIntentId: intentRow.id,
      requestMeta: { amountRub: opts.amountRub, method, companyId: opts.companyId },
      finished: false,
    });
    const t0 = Date.now();

    try {
      const res = await fetch(`${base}/v1/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentId: intentRow.id,
          amountRub: opts.amountRub,
          companyId: opts.companyId,
          userId: opts.userId,
          method,
        }),
        signal: AbortSignal.timeout(Number(process.env.PAYMENTS_TIMEOUT_MS || 8000)),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          intent?: {
            id?: string;
            provider?: string;
            status?: string;
            confirmUrl?: string;
            providerPaymentId?: string;
            webhook?: { ok?: boolean; body?: { entry?: unknown; company?: unknown } };
          };
          webhook?: { ok?: boolean; body?: { entry?: unknown; company?: unknown } };
          pending?: boolean;
          confirmUrl?: string;
        };
        const webhook = data.intent?.webhook || data.webhook;
        const provider =
          data.intent?.provider === "yookassa" ? ("yookassa" as const) : ("payments-stub" as const);

        await completeServiceCall(prisma, payCall.id, {
          status: "OK",
          durationMs: Date.now() - t0,
          responseMeta: {
            provider,
            pending: Boolean(data.pending || data.intent?.status === "pending"),
            intentStatus: data.intent?.status || null,
          },
        });

        await prisma.paymentIntent.update({
          where: { id: intentRow.id },
          data: {
            provider,
            method: data.intent?.provider === "yookassa" ? method === "stub" ? "card" : method : "stub",
            confirmUrl: data.confirmUrl || data.intent?.confirmUrl || null,
            providerPaymentId: data.intent?.providerPaymentId || null,
            status:
              data.pending || data.intent?.status === "pending"
                ? "PENDING"
                : data.intent?.status === "succeeded"
                  ? "SUCCEEDED"
                  : "PENDING",
            paidAt: data.intent?.status === "succeeded" ? new Date() : null,
          },
        });

        if (data.pending || data.intent?.status === "pending") {
          const company = await prisma.company.findUnique({ where: { id: opts.companyId } });
          return {
            entry: null,
            company,
            provider,
            intentId: intentRow.id,
            pending: true,
            confirmUrl: data.confirmUrl || data.intent?.confirmUrl || null,
          };
        }

        if (webhook?.ok && webhook.body?.entry) {
          const company =
            webhook.body.company ||
            (await prisma.company.findUnique({ where: { id: opts.companyId } }));
          return {
            entry: webhook.body.entry,
            company,
            provider,
            intentId: intentRow.id,
          };
        }
        if (webhook?.ok || data.intent?.id) {
          const company = await prisma.company.findUnique({ where: { id: opts.companyId } });
          const entry = await prisma.ledgerEntry.findFirst({
            where: { companyId: opts.companyId, kind: "TOPUP", paymentIntentId: intentRow.id },
          });
          return {
            entry:
              entry ||
              (await prisma.ledgerEntry.findFirst({
                where: { companyId: opts.companyId, kind: "TOPUP" },
                orderBy: { createdAt: "desc" },
              })),
            company,
            provider,
            intentId: intentRow.id,
          };
        }
      } else {
        const text = await res.text().catch(() => "");
        await completeServiceCall(prisma, payCall.id, {
          status: "FAILED",
          durationMs: Date.now() - t0,
          error: `HTTP ${res.status} ${text.slice(0, 200)}`.trim(),
          responseMeta: { statusCode: res.status },
        });
        await prisma.paymentIntent.update({
          where: { id: intentRow.id },
          data: { status: "FAILED" },
        });
      }
    } catch (e) {
      const status = classifyServiceError(e);
      await completeServiceCall(prisma, payCall.id, {
        status,
        durationMs: Date.now() - t0,
        error: e instanceof Error ? e.message : "payments checkout failed",
      }).catch(() => undefined);
      await prisma.paymentIntent
        .update({ where: { id: intentRow.id }, data: { status: "FAILED" } })
        .catch(() => undefined);
      /* fall through to mock gate */
    }
  }

  if (!(await isMockTopupAllowedBySettings())) {
    throw new Error(
      "Mock topup disabled. Enable mockTopupAllowed in admin settings and ALLOW_MOCK_TOPUP, or configure PAYMENTS_SERVICE_URL."
    );
  }

  const entry = await creditCompany({
    companyId: opts.companyId,
    amountRub: opts.amountRub,
    kind: "TOPUP",
    description: `Пополнение (${opts.method || "mock"})`,
    createdById: opts.userId,
  });
  const company = await prisma.company.findUnique({ where: { id: opts.companyId } });
  const to =
    (company as { contactEmail?: string | null } | null)?.contactEmail ||
    process.env.NOTIFY_OPS_EMAIL ||
    "ops@lbm.local";
  const outbox = await enqueueOutbox(prisma, {
    template: "ledger.topup",
    to,
    payload: {
      companyId: opts.companyId,
      amountRub: opts.amountRub,
      balanceAfter: company?.balanceRub,
      provider: "mock",
    },
    companyId: opts.companyId,
    ledgerEntryId: (entry as { id?: string })?.id,
  });
  await kickNotifyDelivery({
    template: "ledger.topup",
    to,
    payload: {
      companyId: opts.companyId,
      amountRub: opts.amountRub,
      balanceAfter: company?.balanceRub,
      provider: "mock",
    },
    outboxId: outbox.id,
  });
  return { entry, company, provider: "mock" };
}

/**
 * Domain webhook handler for payments TOPUP (idempotent on paymentIntentId).
 */
export async function applyPaymentsTopupWebhook(body: {
  companyId: string;
  amountRub: number;
  intentId?: string | null;
  id?: string | null;
  provider?: string;
  userId?: string | null;
  method?: string;
}) {
  const companyId = body.companyId;
  const amount = Number(body.amountRub);
  if (!companyId || !amount || amount <= 0) {
    throw new Error("companyId and amountRub required");
  }
  const intentId = body.intentId || body.id || null;

  if (intentId) {
    const byIntent = await prisma.ledgerEntry.findFirst({
      where: { paymentIntentId: intentId },
    });
    if (byIntent) {
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      return { ok: true, deduped: true, entry: byIntent, company };
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "companies" WHERE id = ${companyId} FOR UPDATE`;
    const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
    const balanceAfter = company.balanceRub + amount;
    await tx.company.update({
      where: { id: companyId },
      data: { balanceRub: balanceAfter },
    });
    if (intentId) {
      await tx.paymentIntent.updateMany({
        where: { id: intentId },
        data: {
          status: "SUCCEEDED",
          paidAt: new Date(),
          provider: body.provider || "stub",
        },
      });
    }
    const entry = await tx.ledgerEntry.create({
      data: {
        companyId,
        amountRub: amount,
        balanceAfter,
        kind: "TOPUP",
        description: `Эквайринг TOPUP${intentId ? ` · ${intentId}` : ""} (${body.provider || "stub"})`,
        createdById: body.userId || null,
        paymentIntentId: intentId,
      },
    });
    const to = company.contactEmail || process.env.NOTIFY_OPS_EMAIL || "ops@lbm.local";
    const outbox = await enqueueOutbox(tx, {
      template: "ledger.topup",
      to,
      payload: {
        companyId,
        amountRub: amount,
        intentId,
        balanceAfter,
      },
      companyId,
      paymentIntentId: intentId,
      ledgerEntryId: entry.id,
    });
    return {
      entry,
      company: { ...company, balanceRub: balanceAfter },
      outboxId: outbox.id,
      notifyTo: to,
    };
  });

  await kickNotifyDelivery({
    template: "ledger.topup",
    to: result.notifyTo,
    payload: {
      companyId,
      amountRub: amount,
      intentId,
      balanceAfter: result.company.balanceRub,
    },
    outboxId: result.outboxId,
  });

  return { ok: true, entry: result.entry, company: result.company };
}
