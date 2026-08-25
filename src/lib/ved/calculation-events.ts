/**
 * Append-only calculation request history (D24).
 * Status machine remains on Calculation.status (D8); events are an audit trail.
 */
import type { CalculationEventKind, Prisma } from "@prisma/client";
import { z } from "zod";

export const CALCULATION_EVENT_KINDS = [
  "CREATED",
  "AI_DRAFT",
  "STATUS",
  "PAID",
  "CLAIMED",
  "ITEM_MAPPED",
  "APPROVED",
  "NOTE",
] as const satisfies readonly CalculationEventKind[];

export const calculationEventPayloadSchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
    draft: z.record(z.unknown()).optional(),
    items: z.array(z.record(z.unknown())).optional(),
    note: z.string().max(2000).optional(),
    number: z.string().optional(),
  })
  .strict();

export type CalculationEventPayload = z.infer<typeof calculationEventPayloadSchema>;

export type AppendCalculationEventInput = {
  calculationId: string;
  kind: CalculationEventKind;
  actorUserId?: string | null;
  payload?: CalculationEventPayload | null;
};

type EventWriter = Pick<Prisma.TransactionClient, "calculationEvent">;

/** Drop undefined so Prisma can serialize payload as JSON. */
export function toJsonPayload(payload: CalculationEventPayload): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(calculationEventPayloadSchema.parse(payload))) as Prisma.InputJsonValue;
}

/** Persist one history row (call inside the same tx as the domain mutation when possible). */
export async function appendCalculationEvent(
  db: EventWriter,
  input: AppendCalculationEventInput
): Promise<void> {
  await db.calculationEvent.create({
    data: {
      calculationId: input.calculationId,
      kind: input.kind,
      actorUserId: input.actorUserId ?? null,
      payload: input.payload == null ? undefined : toJsonPayload(input.payload),
    },
  });
}

export function statusChangePayload(from: string, to: string): CalculationEventPayload {
  return { from, to };
}

type EventReader = Pick<Prisma.TransactionClient, "calculationEvent">;

/** Newest-last chronological trail for UI timeline. */
export async function listCalculationEvents(db: EventReader, calculationId: string) {
  return db.calculationEvent.findMany({
    where: { calculationId },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      actor: { select: { id: true, name: true, role: true } },
    },
  });
}
