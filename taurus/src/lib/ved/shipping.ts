/**
 * ShippingRequest writer (D-SHIP / D15). Prisma is injected — unit and DB
 * integration tests share this module instead of duplicating route logic.
 */
import type { PrismaClient, ShippingRequest, ShippingStatus } from "@prisma/client";
import { assertShippingAllowed, fetchShippingQuotes, type ShippingTracking } from "./logistics";

/** PrismaClient or interactive transaction — same model delegates. */
type Db = {
  calculation: PrismaClient["calculation"];
  shippingRequest: PrismaClient["shippingRequest"];
};

export const TRACKING_APPLY_STATUSES: ShippingStatus[] = [
  "NEW",
  "QUOTED",
  "IN_TRANSIT",
  "DELIVERED",
];

export class ShippingError extends Error {
  readonly httpStatus: number;
  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = "ShippingError";
    this.httpStatus = httpStatus;
  }
}

export function isAllowedTrackingStatus(status: string): status is ShippingStatus {
  return (TRACKING_APPLY_STATUSES as string[]).includes(status);
}

export type CreateShippingInput = {
  userId: string;
  companyId: string;
  calculationId: string;
  origin: string;
  destination: string;
  mode: string;
  comment?: string;
  selectedQuoteId?: string;
};

/** Persist a waybill after DONE. Status starts at QUOTED with stub/service quotes. */
export async function createShippingRequest(
  db: Db,
  input: CreateShippingInput
): Promise<ShippingRequest> {
  const calc = await db.calculation.findFirst({
    where: { id: input.calculationId, clientUserId: input.userId },
  });
  if (!calc) throw new ShippingError("Calculation not found", 404);
  try {
    assertShippingAllowed(calc.status);
  } catch (e) {
    throw new ShippingError(
      e instanceof Error ? e.message : "Shipping only after DONE",
      400
    );
  }

  const quotes = await fetchShippingQuotes({
    origin: input.origin,
    destination: input.destination,
    preferredMode: input.mode,
  });
  const selected =
    quotes.find((q) => q.id === input.selectedQuoteId) ||
    quotes.find((q) => q.mode === input.mode.toUpperCase()) ||
    quotes[0];
  const withSelected = quotes.map((q) => ({ ...q, selected: q.id === selected?.id }));

  return db.shippingRequest.create({
    data: {
      companyId: input.companyId,
      calculationId: input.calculationId,
      origin: input.origin,
      destination: input.destination,
      mode: selected?.mode || input.mode,
      comment: input.comment,
      trackingCode: `LC-${Math.floor(1000 + Math.random() * 9000)}`,
      status: "QUOTED",
      quotes: withSelected,
      selectedQuote: selected || null,
      eta: selected ? new Date(Date.now() + selected.etaDays * 86400_000) : null,
    },
  });
}

/** Apply logistics tracking to a row. Unknown / terminal statuses are no-ops. */
export async function applyShippingTracking(
  db: Db,
  row: ShippingRequest,
  track: ShippingTracking | null
): Promise<ShippingRequest & { trackingEvents: ShippingTracking["events"] | null }> {
  if (!row.trackingCode || row.status === "DELIVERED" || row.status === "CANCELLED") {
    return { ...row, trackingEvents: track?.events || null };
  }
  if (!track?.status || track.status === row.status) {
    return { ...row, trackingEvents: track?.events || null };
  }
  if (!isAllowedTrackingStatus(track.status)) {
    return { ...row, trackingEvents: track.events || null };
  }
  try {
    const updated = await db.shippingRequest.update({
      where: { id: row.id },
      data: {
        status: track.status,
        eta: track.eta ? new Date(track.eta) : row.eta,
      },
    });
    return { ...updated, trackingEvents: track.events || null };
  } catch {
    return { ...row, trackingEvents: track.events || null };
  }
}
