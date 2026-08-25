/**
 * Client reaction on TN VED draft (AI_READY+) or assembled result (DONE).
 */
import { prisma } from "@/lib/prisma";
import { appendCalculationEvent } from "@/lib/ved/calculation-events";
import { z } from "zod";

export const CLIENT_FEEDBACK_REACTIONS = ["HELPFUL", "NEEDS_WORK"] as const;
export type ClientFeedbackReaction = (typeof CLIENT_FEEDBACK_REACTIONS)[number];

export const clientFeedbackInputSchema = z.object({
  reaction: z.enum(CLIENT_FEEDBACK_REACTIONS),
  comment: z.string().max(2000).optional(),
});

export type ClientFeedbackInput = z.infer<typeof clientFeedbackInputSchema>;

function feedbackNote(reaction: ClientFeedbackReaction, comment?: string): string {
  const base =
    reaction === "HELPFUL" ? "Клиент: результат полезен" : "Клиент: нужна доработка";
  const trimmed = comment?.trim();
  if (!trimmed) return base;
  return `${base} — ${trimmed.slice(0, 500)}`;
}

export const CLIENT_FEEDBACK_ALLOWED_STATUSES = [
  "AI_READY",
  "AWAITING_PAYMENT",
  "QUEUED",
  "IN_REVIEW",
  "SLA_RISK",
  "DONE",
] as const;

export async function submitClientCalculationFeedback(opts: {
  calculationId: string;
  clientUserId: string;
  input: ClientFeedbackInput;
}) {
  const parsed = clientFeedbackInputSchema.parse(opts.input);
  const comment = parsed.comment?.trim() || null;

  return prisma.$transaction(async (tx) => {
    const calc = await tx.calculation.findUnique({
      where: { id: opts.calculationId },
      select: {
        id: true,
        clientUserId: true,
        status: true,
        clientFeedbackAt: true,
      },
    });
    if (!calc) throw new Error("Not found");
    if (calc.clientUserId !== opts.clientUserId) throw new Error("Forbidden");
    if (
      !(CLIENT_FEEDBACK_ALLOWED_STATUSES as readonly string[]).includes(calc.status)
    ) {
      throw new Error("Feedback only after TN VED draft is ready");
    }
    if (calc.clientFeedbackAt) throw new Error("Feedback already submitted");

    const updated = await tx.calculation.update({
      where: { id: calc.id },
      data: {
        clientFeedbackReaction: parsed.reaction,
        clientFeedbackComment: comment,
        clientFeedbackAt: new Date(),
      },
      omit: { pdfHtml: true },
      include: { tariff: true, items: true },
    });

    await appendCalculationEvent(tx, {
      calculationId: calc.id,
      kind: "NOTE",
      actorUserId: opts.clientUserId,
      payload: { note: feedbackNote(parsed.reaction, comment ?? undefined) },
    });

    return updated;
  });
}
