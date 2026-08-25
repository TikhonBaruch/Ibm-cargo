import { afterEach, describe, expect, it, vi } from "vitest";

const { creditMock, findCompany, findEntry, paymentIntentCreate, paymentIntentUpdate } = vi.hoisted(
  () => ({
    creditMock: vi.fn(),
    findCompany: vi.fn(),
    findEntry: vi.fn(),
    paymentIntentCreate: vi.fn(),
    paymentIntentUpdate: vi.fn(),
  })
);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: { findUnique: findCompany },
    ledgerEntry: { findFirst: findEntry },
    paymentIntent: {
      create: paymentIntentCreate,
      update: paymentIntentUpdate,
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock("@/lib/ved/ledger", () => ({
  creditCompany: creditMock,
}));

vi.mock("@/lib/ved/orchestration", () => ({
  enqueueOutbox: vi.fn().mockResolvedValue({ id: "obx1" }),
  kickNotifyDelivery: vi.fn().mockResolvedValue(undefined),
  recordServiceCall: vi.fn().mockResolvedValue({ id: "sc-pay" }),
  completeServiceCall: vi.fn().mockResolvedValue({}),
  classifyServiceError: (e: unknown) => {
    const msg = e instanceof Error ? e.message.toLowerCase() : "";
    return msg.includes("timeout") || msg.includes("aborted") ? "TIMEOUT" : "FAILED";
  },
}));

vi.mock("@/lib/ved/platform-gates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../platform-gates")>();
  return {
    ...actual,
    assertPaymentsEnabled: vi.fn().mockResolvedValue(undefined),
    isMockTopupAllowedBySettings: vi.fn().mockImplementation(async () => {
      const flag = (process.env.ALLOW_MOCK_TOPUP || "").toLowerCase();
      if (flag === "1" || flag === "true" || flag === "yes") return true;
      if ((process.env.DEMO_MODE || "").toLowerCase() === "1") return true;
      if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
        return false;
      }
      return true;
    }),
  };
});

import { applyPaymentsTopupWebhook, topupViaPaymentsOrMock } from "../payments";

describe("topupViaPaymentsOrMock", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("uses payments checkout when PAYMENTS_SERVICE_URL set", async () => {
    vi.stubEnv("PAYMENTS_SERVICE_URL", "http://payments:4300");
    paymentIntentCreate.mockResolvedValue({ id: "i1", companyId: "c1", amountRub: 1000 });
    paymentIntentUpdate.mockResolvedValue({});
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          intent: {
            id: "i1",
            webhook: {
              ok: true,
              body: {
                entry: { id: "e1", amountRub: 1000 },
                company: { id: "c1", balanceRub: 6000 },
              },
            },
          },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await topupViaPaymentsOrMock({
      companyId: "c1",
      amountRub: 1000,
      userId: "u1",
      method: "stub",
    });

    expect(paymentIntentCreate).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://payments:4300/v1/checkout",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.provider).toBe("payments-stub");
    expect(result.intentId).toBe("i1");
    expect(creditMock).not.toHaveBeenCalled();
  });

  it("falls back to mock credit when payments unset", async () => {
    vi.stubEnv("PAYMENTS_SERVICE_URL", "");
    vi.stubEnv("ALLOW_MOCK_TOPUP", "1");
    creditMock.mockResolvedValue({ id: "e2", amountRub: 500 });
    findCompany.mockResolvedValue({ id: "c1", balanceRub: 1500 });

    const result = await topupViaPaymentsOrMock({
      companyId: "c1",
      amountRub: 500,
      method: "mock",
    });

    expect(result.provider).toBe("mock");
    expect(creditMock).toHaveBeenCalled();
  });

  it("falls back to mock when checkout fetch fails", async () => {
    const { completeServiceCall } = await import("../orchestration");
    vi.stubEnv("PAYMENTS_SERVICE_URL", "http://payments:4300");
    vi.stubEnv("ALLOW_MOCK_TOPUP", "1");
    paymentIntentCreate.mockResolvedValue({ id: "i-fail", companyId: "c1", amountRub: 200 });
    paymentIntentUpdate.mockResolvedValue({});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    creditMock.mockResolvedValue({ id: "e3", amountRub: 200 });
    findCompany.mockResolvedValue({ id: "c1", balanceRub: 200 });

    const result = await topupViaPaymentsOrMock({
      companyId: "c1",
      amountRub: 200,
      method: "stub",
    });

    expect(result.provider).toBe("mock");
    expect(completeServiceCall).toHaveBeenCalledWith(
      expect.anything(),
      "sc-pay",
      expect.objectContaining({ status: "FAILED" })
    );
  });

  it("records TIMEOUT ServiceCall when checkout aborts", async () => {
    const { completeServiceCall } = await import("../orchestration");
    vi.stubEnv("PAYMENTS_SERVICE_URL", "http://payments:4300");
    vi.stubEnv("ALLOW_MOCK_TOPUP", "1");
    paymentIntentCreate.mockResolvedValue({ id: "i-to", companyId: "c1", amountRub: 200 });
    paymentIntentUpdate.mockResolvedValue({});
    const abortErr = new Error("The operation was aborted due to timeout");
    abortErr.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortErr));
    creditMock.mockResolvedValue({ id: "e4", amountRub: 200 });
    findCompany.mockResolvedValue({ id: "c1", balanceRub: 200 });

    await topupViaPaymentsOrMock({ companyId: "c1", amountRub: 200, method: "stub" });

    expect(completeServiceCall).toHaveBeenCalledWith(
      expect.anything(),
      "sc-pay",
      expect.objectContaining({ status: "TIMEOUT" })
    );
  });

  it("returns pending when YooKassa checkout awaits provider", async () => {
    vi.stubEnv("PAYMENTS_SERVICE_URL", "http://payments:4300");
    paymentIntentCreate.mockResolvedValue({ id: "i-yoo", companyId: "c1", amountRub: 1500 });
    paymentIntentUpdate.mockResolvedValue({});
    findCompany.mockResolvedValue({ id: "c1", balanceRub: 1000 });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            intent: {
              id: "i-yoo",
              provider: "yookassa",
              status: "pending",
              confirmUrl: "https://yookassa.ru/pay/1",
            },
            pending: true,
            confirmUrl: "https://yookassa.ru/pay/1",
          }),
          { status: 200 }
        )
      )
    );

    const result = await topupViaPaymentsOrMock({
      companyId: "c1",
      amountRub: 1500,
      method: "card",
    });

    expect(result.pending).toBe(true);
    expect(result.provider).toBe("yookassa");
    expect(result.confirmUrl).toContain("yookassa");
    expect(result.entry).toBeNull();
    expect(creditMock).not.toHaveBeenCalled();
  });

  it("rejects mock topup in production without ALLOW_MOCK_TOPUP", async () => {
    vi.stubEnv("PAYMENTS_SERVICE_URL", "");
    vi.stubEnv("ALLOW_MOCK_TOPUP", "");
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");

    await expect(
      topupViaPaymentsOrMock({ companyId: "c1", amountRub: 100 })
    ).rejects.toThrow(/Mock topup disabled/);
    expect(creditMock).not.toHaveBeenCalled();
  });
});

describe("applyPaymentsTopupWebhook", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("dedupes on paymentIntentId", async () => {
    const { prisma } = await import("@/lib/prisma");
    findEntry.mockResolvedValue({ id: "e1", paymentIntentId: "pi1", amountRub: 500 });
    findCompany.mockResolvedValue({ id: "c1", balanceRub: 1500 });

    const result = await applyPaymentsTopupWebhook({
      companyId: "c1",
      amountRub: 500,
      intentId: "pi1",
    });

    expect(result.deduped).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
