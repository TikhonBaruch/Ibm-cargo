/**
 * Email notify for calc/support chat (fail-open; requires RESEND or notify container).
 */
import type { PrismaClient } from "@prisma/client";
import { enqueueOutbox, kickNotifyDelivery } from "./orchestration";

export type CalcChatAccess = {
  id: string;
  number: string;
  companyId: string | null;
  clientUserId: string;
  brokerUserId: string | null;
};

export function assertCalculationChatAccess(
  calc: CalcChatAccess,
  userId: string,
  role: string
): void {
  if (role === "ADMIN" || role === "SUPER_ADMIN") return;
  if (role === "CLIENT") {
    if (calc.clientUserId !== userId) throw new Error("Forbidden");
    return;
  }
  if (role === "BROKER") {
    if (calc.brokerUserId !== userId) throw new Error("Forbidden");
    return;
  }
  throw new Error("Forbidden");
}

async function resolveUserEmail(
  db: PrismaClient,
  userId: string | null | undefined
): Promise<string | null> {
  if (!userId) return null;
  const u = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  const email = u?.email?.trim();
  return email && email.includes("@") ? email : null;
}

export async function notifyCalculationChatMessage(
  db: PrismaClient,
  opts: {
    calc: CalcChatAccess;
    authorRole: string;
    bodyPreview: string;
  }
): Promise<void> {
  let to: string | null = null;
  if (opts.authorRole === "CLIENT") {
    to = await resolveUserEmail(db, opts.calc.brokerUserId);
  } else if (opts.authorRole === "BROKER") {
    to = await resolveUserEmail(db, opts.calc.clientUserId);
  }
  if (!to) return;

  const payload = {
    calculationId: opts.calc.id,
    number: opts.calc.number,
    preview: opts.bodyPreview.slice(0, 200),
  };
  const outbox = await enqueueOutbox(db, {
    template: "chat.message",
    to,
    payload,
    calculationId: opts.calc.id,
    companyId: opts.calc.companyId,
  });
  await kickNotifyDelivery({
    template: "chat.message",
    to,
    payload,
    outboxId: outbox.id,
  });
}

export async function notifySupportChatMessage(
  db: PrismaClient,
  opts: {
    threadId: string;
    subject: string;
    authorRole: string;
    clientUserId: string | null;
    bodyPreview: string;
    isNewTicket?: boolean;
  }
): Promise<void> {
  let to: string | null = null;
  const template = opts.isNewTicket ? "chat.support_new" : "chat.support_reply";
  if (opts.authorRole === "CLIENT") {
    to = process.env.NOTIFY_OPS_EMAIL?.trim() || null;
  } else {
    to = await resolveUserEmail(db, opts.clientUserId);
  }
  if (!to || !to.includes("@")) return;

  const payload = {
    threadId: opts.threadId,
    subject: opts.subject,
    preview: opts.bodyPreview.slice(0, 200),
  };
  const outbox = await enqueueOutbox(db, { template, to, payload });
  await kickNotifyDelivery({ template, to, payload, outboxId: outbox.id });
}
