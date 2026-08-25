import { buildStubShippingQuotes } from "./domain";
import type { ShippingQuoteStub } from "./domain";

/** D15: shipping requests only after calculation DONE. */
export function assertShippingAllowed(status: string): void {
  if (status !== "DONE") {
    throw new Error("Shipping only after DONE");
  }
}

export type ShippingTracking = {
  trackingCode: string;
  status: string;
  eta?: string;
  events?: Array<{ at: string; status: string; label: string }>;
  provider?: string;
};

export async function fetchShippingQuotes(opts: {
  origin: string;
  destination: string;
  preferredMode?: string;
}): Promise<ShippingQuoteStub[]> {
  const base = (process.env.LOGISTICS_SERVICE_URL || "").replace(/\/$/, "");
  if (base) {
    try {
      const res = await fetch(`${base}/v1/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: opts.origin,
          destination: opts.destination,
          mode: opts.preferredMode,
        }),
        signal: AbortSignal.timeout(Number(process.env.LOGISTICS_TIMEOUT_MS || 3000)),
      });
      if (res.ok) {
        const data = (await res.json()) as { quotes?: ShippingQuoteStub[] };
        if (Array.isArray(data.quotes) && data.quotes.length > 0) {
          return data.quotes.map((q) => ({
            id: q.id,
            mode: q.mode,
            etaDays: q.etaDays,
            priceRub: q.priceRub,
            carrierLabel: q.carrierLabel,
            selected: q.selected,
          }));
        }
      }
    } catch {
      /* fall through */
    }
  }
  return buildStubShippingQuotes(opts);
}

/** Refresh tracking timeline from logistics service (fail-open → null). */
export async function fetchShippingTracking(trackingCode: string): Promise<ShippingTracking | null> {
  const base = (process.env.LOGISTICS_SERVICE_URL || "").replace(/\/$/, "");
  if (!base || !trackingCode) return null;
  try {
    const res = await fetch(`${base}/v1/tracking/${encodeURIComponent(trackingCode)}`, {
      method: "GET",
      signal: AbortSignal.timeout(Number(process.env.LOGISTICS_TIMEOUT_MS || 3000)),
    });
    if (!res.ok) return null;
    return (await res.json()) as ShippingTracking;
  } catch {
    return null;
  }
}
