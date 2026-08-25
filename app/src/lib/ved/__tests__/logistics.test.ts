import { afterEach, describe, expect, it, vi } from "vitest";
import { assertShippingAllowed, fetchShippingQuotes, fetchShippingTracking } from "../logistics";

describe("assertShippingAllowed (D15)", () => {
  it("allows DONE", () => {
    expect(() => assertShippingAllowed("DONE")).not.toThrow();
  });

  it("rejects pre-DONE statuses", () => {
    for (const status of [
      "DRAFT",
      "AI_PROCESSING",
      "AI_READY",
      "AWAITING_PAYMENT",
      "QUEUED",
      "IN_REVIEW",
      "SLA_RISK",
      "CANCELLED",
    ]) {
      expect(() => assertShippingAllowed(status)).toThrow(/Shipping only after DONE/);
    }
  });

  it("error message is stable for API clients", () => {
    expect(() => assertShippingAllowed("QUEUED")).toThrow("Shipping only after DONE");
  });
});

describe("fetchShippingQuotes (logistics stub client)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("falls back to local stub when LOGISTICS_SERVICE_URL unset", async () => {
    vi.stubEnv("LOGISTICS_SERVICE_URL", "");
    const q = await fetchShippingQuotes({
      origin: "Шанхай",
      destination: "Москва",
      preferredMode: "AIR",
    });
    expect(q.length).toBe(3);
    expect(q.find((x) => x.mode === "AIR")?.selected).toBe(true);
  });

  it("uses logistics service when available", async () => {
    vi.stubEnv("LOGISTICS_SERVICE_URL", "http://logistics:4600");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          quotes: [
            {
              id: "q_lcl",
              mode: "LCL",
              etaDays: 28,
              priceRub: 1000,
              carrierLabel: "FromService",
              selected: true,
            },
          ],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const q = await fetchShippingQuotes({ origin: "A", destination: "B" });
    expect(fetchMock).toHaveBeenCalled();
    expect(q[0].carrierLabel).toBe("FromService");
  });

  it("falls back when logistics fetch fails", async () => {
    vi.stubEnv("LOGISTICS_SERVICE_URL", "http://logistics:4600");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const q = await fetchShippingQuotes({ origin: "X", destination: "Y" });
    expect(q.length).toBe(3);
  });
});

describe("fetchShippingTracking", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns null when service unset", async () => {
    vi.stubEnv("LOGISTICS_SERVICE_URL", "");
    expect(await fetchShippingTracking("LC-1234")).toBeNull();
  });

  it("maps tracking payload from logistics", async () => {
    vi.stubEnv("LOGISTICS_SERVICE_URL", "http://logistics:4600");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            trackingCode: "LC-1234",
            status: "IN_TRANSIT",
            events: [{ at: "2026-08-01T00:00:00.000Z", status: "IN_TRANSIT", label: "В пути" }],
          }),
          { status: 200 }
        )
      )
    );
    const t = await fetchShippingTracking("LC-1234");
    expect(t?.status).toBe("IN_TRANSIT");
    expect(t?.events?.length).toBe(1);
  });
});
