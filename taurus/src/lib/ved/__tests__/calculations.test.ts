import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, creditCompanyMock } = vi.hoisted(() => {
  const prismaMock = {
    calculation: {
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    calculationItem: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    calculationEvent: {
      create: vi.fn().mockResolvedValue({ id: "evt1" }),
    },
    tariffPlan: {
      findUnique: vi.fn(),
    },
    brokerProfile: {
      findUnique: vi.fn(),
    },
    brokerPayout: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    brokerAssignment: {
      create: vi.fn(),
    },
    chatThread: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ email: "client@example.com" }),
    },
    manufacturerSku: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { prismaMock, creditCompanyMock: vi.fn().mockResolvedValue({}) };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ved/ledger", () => ({
  creditCompany: creditCompanyMock,
}));
vi.mock("@/lib/ved/settings", () => ({
  getPlatformSettings: vi.fn().mockResolvedValue({
    confidenceThreshold: 0.75,
    defaultSlaHours: 4,
    preferredClaimHours: 4,
    usdRate: 90,
    autoAssignBrokers: false,
    marketplaceEnabled: true,
    maintenanceMode: false,
    paymentsEnabled: true,
    llmEnrichEnabled: true,
    notifyEnabled: true,
    mockTopupAllowed: true,
  }),
}));
vi.mock("@/lib/audit", () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ved/ai", () => ({
  requestAiDraft: vi.fn().mockResolvedValue({
    hsCode: "8471 30 000 0",
    duties: { customsDutyPercent: 7, vatPercent: 22, feeRub: 50 },
    documents: [],
    confidence: 0.9,
    disclaimer: "stub",
  }),
}));

vi.mock("@/lib/ved/orchestration", () => ({
  enqueueOutbox: vi.fn().mockResolvedValue({ id: "obx1" }),
  enqueueBackgroundJob: vi.fn().mockResolvedValue({ id: "job-ai" }),
  kickNotifyDelivery: vi.fn().mockResolvedValue(undefined),
  recordServiceCall: vi.fn().mockResolvedValue({ id: "sc1" }),
  completeServiceCall: vi.fn().mockResolvedValue({}),
  classifyServiceError: vi.fn().mockReturnValue("FAILED"),
}));

import {
  approveCalculation,
  claimCalculation,
  createAndDraftCalculation,
  escalateSla,
  payCalculation,
  saveCalculationItems,
  runSlaTick,
} from "../calculations";

function baseCalc(over: Record<string, unknown> = {}) {
  return {
    id: "calc1",
    number: "#47901",
    title: "Ноутбуки",
    status: "AI_READY",
    clientUserId: "client1",
    companyId: "co1",
    brokerUserId: null,
    tariffId: "t1",
    hsCode: "8471 30 000 0",
    confidence: 0.94,
    dutyRub: 100,
    vatRub: 200,
    feeRub: 50,
    totalPaymentsRub: 350,
    aiDraft: { disclaimer: "stub" },
    tariff: {
      id: "t1",
      code: "EXPRESS",
      name: "Экспресс",
      priceRub: 990,
      slaHours: 1,
      brokerSharePct: 0,
    },
    company: { id: "co1", balanceRub: 50000 },
    ...over,
  };
}

describe("payCalculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    creditCompanyMock.mockImplementation(async (opts: { after?: (tx: unknown) => Promise<unknown> }) => {
      if (opts.after) {
        return opts.after({
          calculation: { update: prismaMock.calculation.update },
          calculationEvent: { create: prismaMock.calculationEvent.create },
        });
      }
      return {};
    });
    prismaMock.calculation.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...baseCalc({ items: [] }),
      ...data,
      tariff: baseCalc().tariff,
      items: [],
    }));
  });

  it("Express + high confidence → DONE with PDF", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(baseCalc({ items: [] }));

    const result = await payCalculation({
      calculationId: "calc1",
      clientUserId: "client1",
    });

    expect(creditCompanyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "co1",
        amountRub: -990,
        kind: "TARIFF_CHARGE",
        after: expect.any(Function),
      })
    );
    expect(result.status).toBe("DONE");
    expect(result.pdfHtml).toContain("LBM Брокер");
    expect(result.hsCodeFinal).toBe("8471 30 000 0");
  });

  it("STANDARD → QUEUED (broker required)", async () => {
    const tariff = {
      id: "t2",
      code: "STANDARD",
      name: "Стандарт",
      priceRub: 2990,
      slaHours: 4,
      brokerSharePct: 35,
    };
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(baseCalc({ tariff, items: [] }));
    prismaMock.calculation.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "calc1",
      number: "#47901",
      ...data,
      tariff,
      items: [],
    }));

    const result = await payCalculation({
      calculationId: "calc1",
      clientUserId: "client1",
    });

    expect(result.status).toBe("QUEUED");
    expect(result.pdfHtml).toBeNull();
    expect(result.queuedAt).toBeTruthy();
    expect(result.slaDeadline).toBeTruthy();
  });

  it("rejects pay by another client", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(baseCalc());
    await expect(
      payCalculation({ calculationId: "calc1", clientUserId: "other" })
    ).rejects.toThrow(/Forbidden/);
  });

  it("idempotent when already paid (DONE + paidAt)", async () => {
    const paid = baseCalc({ status: "DONE", paidAt: new Date(), items: [] });
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(paid);
    const result = await payCalculation({ calculationId: "calc1", clientUserId: "client1" });
    expect(result.status).toBe("DONE");
    expect(creditCompanyMock).not.toHaveBeenCalled();
  });

  it("rejects pay from unpaid non-payable status", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({ status: "IN_REVIEW", paidAt: null })
    );
    await expect(
      payCalculation({ calculationId: "calc1", clientUserId: "client1" })
    ).rejects.toThrow(/Cannot pay/);
  });

  it("propagates insufficient balance from ledger", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(baseCalc({ items: [] }));
    creditCompanyMock.mockRejectedValue(new Error("Insufficient balance"));
    await expect(
      payCalculation({ calculationId: "calc1", clientUserId: "client1" })
    ).rejects.toThrow(/Insufficient balance/);
  });

  it("stores preferredBrokerUserId on pay", async () => {
    const tariff = {
      id: "t2",
      code: "STANDARD",
      name: "Стандарт",
      priceRub: 2990,
      slaHours: 4,
      brokerSharePct: 35,
    };
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(baseCalc({ tariff, items: [] }));
    prismaMock.calculation.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "calc1",
      ...data,
    }));

    await payCalculation({
      calculationId: "calc1",
      clientUserId: "client1",
      preferredBrokerUserId: "brokerPreferred",
    });

    expect(prismaMock.calculation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ preferredBrokerUserId: "brokerPreferred", status: "QUEUED" }),
      })
    );
  });
});

describe("claimCalculation", () => {
  function mockClaimTx(opts: { count?: number; status?: string } = {}) {
    const count = opts.count ?? 1;
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        calculation: {
          updateMany: vi.fn().mockResolvedValue({ count }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "calc1",
            status: opts.status ?? "IN_REVIEW",
            brokerUserId: "broker1",
          }),
        },
        brokerAssignment: { create: vi.fn().mockResolvedValue({}) },
        chatThread: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({}),
        },
        calculationEvent: { create: prismaMock.calculationEvent.create },
      };
      return fn(tx);
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves QUEUED → IN_REVIEW and creates assignment", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({ status: "QUEUED", tariff: undefined })
    );
    mockClaimTx();

    const row = await claimCalculation({
      calculationId: "calc1",
      brokerUserId: "broker1",
    });
    expect(row.status).toBe("IN_REVIEW");
  });

  it("rejects claim from AI_READY", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(baseCalc({ status: "AI_READY" }));
    await expect(
      claimCalculation({ calculationId: "calc1", brokerUserId: "broker1" })
    ).rejects.toThrow(/Cannot claim/);
  });

  it("rejects claim conflict when updateMany count is 0", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({ status: "QUEUED", tariff: undefined })
    );
    mockClaimTx({ count: 0 });
    await expect(
      claimCalculation({ calculationId: "calc1", brokerUserId: "broker1" })
    ).rejects.toThrow(/Claim conflict/);
  });

  it("rejects claim by non-preferred broker while exclusive", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({
        status: "QUEUED",
        preferredBrokerUserId: "broker1",
        queuedAt: new Date(),
      })
    );
    await expect(
      claimCalculation({ calculationId: "calc1", brokerUserId: "broker2" })
    ).rejects.toThrow(/preferred/);
  });

  it("allows claim by other broker after preferred timeout", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({
        status: "QUEUED",
        preferredBrokerUserId: "broker1",
        queuedAt: new Date(Date.now() - 10 * 3600_000),
      })
    );
    mockClaimTx({ status: "IN_REVIEW" });
    // override findUniqueOrThrow inside tx return broker2
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        calculation: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "calc1",
            status: "IN_REVIEW",
            brokerUserId: "broker2",
          }),
        },
        brokerAssignment: { create: vi.fn().mockResolvedValue({}) },
        chatThread: {
          findFirst: vi.fn().mockResolvedValue({ id: "t1" }),
          create: vi.fn(),
        },
        calculationEvent: { create: prismaMock.calculationEvent.create },
      };
      return fn(tx);
    });

    const row = await claimCalculation({
      calculationId: "calc1",
      brokerUserId: "broker2",
    });
    expect(row.status).toBe("IN_REVIEW");
  });
});

describe("saveCalculationItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.calculationItem.findMany.mockResolvedValue([]);
  });

  it("persists mapping and keeps IN_REVIEW", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({
        status: "IN_REVIEW",
        brokerUserId: "broker1",
        feeRub: 100,
        tariff: { id: "t2", code: "STANDARD", priceRub: 2990 },
        items: [{ id: "i1", name: "Ноут" }],
      })
    );
    prismaMock.calculationItem.findMany.mockResolvedValue([
      {
        id: "i1",
        name: "Ноут",
        hsCodeFinal: "8471 50 000 0",
        dutyRub: 1111,
        vatRub: 2222,
      },
    ]);
    prismaMock.calculation.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "calc1",
      number: "#47901",
      status: "IN_REVIEW",
      ...data,
      items: [
        {
          id: "i1",
          hsCodeFinal: "8471 50 000 0",
          dutyRub: 1111,
          vatRub: 2222,
        },
      ],
    }));

    const result = await saveCalculationItems({
      calculationId: "calc1",
      brokerUserId: "broker1",
      hsCodeFinal: "8471 50 000 0",
      feeRub: 13337,
      items: [
        {
          id: "i1",
          hsCodeFinal: "8471 50 000 0",
          dutyRub: 1111,
          vatRub: 2222,
          unitPrice: 2500,
        },
      ],
    });

    expect(prismaMock.calculationItem.update).toHaveBeenCalled();
    expect(result.status).toBe("IN_REVIEW");
    expect(result.hsCodeFinal).toBe("8471 50 000 0");
    expect(result.feeRub).toBe(13337);
    expect(result.dutyRub).toBe(1111);
    expect(result.vatRub).toBe(2222);
  });

  it("persists item description and extra fee without touching Calculation.description", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({
        status: "IN_REVIEW",
        brokerUserId: "broker1",
        description: "клиент: ноут из китая",
        extraFeeRub: 0,
        extraFeeNote: null,
        feeRub: 100,
        tariff: { id: "t2", code: "STANDARD", priceRub: 2990 },
        items: [{ id: "i1", name: "Ноут" }],
      })
    );
    prismaMock.calculationItem.findMany.mockResolvedValue([
      {
        id: "i1",
        name: "Ноут",
        description: "Портативная ЭВМ",
        hsCodeFinal: "8471 50 000 0",
        dutyRub: 100,
        vatRub: 200,
      },
    ]);
    prismaMock.calculation.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "calc1",
      number: "#47901",
      status: "IN_REVIEW",
      description: "клиент: ноут из китая",
      ...data,
      items: [{ id: "i1", description: "Портативная ЭВМ" }],
    }));

    const result = await saveCalculationItems({
      calculationId: "calc1",
      brokerUserId: "broker1",
      hsCodeFinal: "8471 50 000 0",
      feeRub: 1231,
      extraFeeRub: 400,
      extraFeeNote: "досмотр",
      items: [
        {
          id: "i1",
          hsCodeFinal: "8471 50 000 0",
          dutyRub: 100,
          vatRub: 200,
          description: "Портативная ЭВМ",
        },
      ],
    });

    expect(prismaMock.calculationItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: "Портативная ЭВМ" }),
      })
    );
    const calcData = prismaMock.calculation.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(calcData.description).toBeUndefined();
    expect(calcData.extraFeeRub).toBe(400);
    expect(calcData.extraFeeNote).toBe("досмотр");
    expect(calcData.totalPaymentsRub).toBe(100 + 200 + 1231 + 400);
    expect(result.description).toBe("клиент: ноут из китая");
  });

  it("rejects extra fee without a note", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({
        status: "IN_REVIEW",
        brokerUserId: "broker1",
        extraFeeRub: 0,
        tariff: { code: "STANDARD" },
        items: [{ id: "i1", name: "Ноут" }],
      })
    );
    await expect(
      saveCalculationItems({
        calculationId: "calc1",
        brokerUserId: "broker1",
        extraFeeRub: 50,
        extraFeeNote: " ",
        items: [{ id: "i1", hsCodeFinal: "8471" }],
      })
    ).rejects.toThrow(/прочие сборы/);
  });

  it("fills empty attrs only and keeps client brand", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({
        status: "IN_REVIEW",
        brokerUserId: "broker1",
        feeRub: 100,
        tariff: { id: "t2", code: "STANDARD", priceRub: 2990 },
        items: [{ id: "i1", name: "Ноут", attrs: { brand: "Lenovo" } }],
      })
    );
    prismaMock.calculationItem.findMany.mockResolvedValue([
      {
        id: "i1",
        name: "Ноут",
        attrs: { brand: "Lenovo", netWeightKg: 1.5 },
        hsCodeFinal: "8471",
        dutyRub: 10,
        vatRub: 20,
      },
    ]);
    prismaMock.calculation.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "calc1",
      status: "IN_REVIEW",
      ...data,
    }));

    await saveCalculationItems({
      calculationId: "calc1",
      brokerUserId: "broker1",
      items: [
        {
          id: "i1",
          hsCodeFinal: "8471",
          dutyRub: 10,
          vatRub: 20,
          attrs: { brand: "Hacked", netWeightKg: 1.5 },
        },
      ],
    });

    expect(prismaMock.calculationItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attrs: { brand: "Lenovo", netWeightKg: 1.5 },
        }),
      })
    );
  });

  it("rejects wrong broker / wrong status / synthetic id", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({
        status: "IN_REVIEW",
        brokerUserId: "broker1",
        tariff: { code: "STANDARD" },
        items: [{ id: "i1", name: "Ноут" }],
      })
    );
    await expect(
      saveCalculationItems({
        calculationId: "calc1",
        brokerUserId: "broker2",
        items: [{ id: "i1", hsCodeFinal: "8471" }],
      })
    ).rejects.toThrow(/Forbidden/);

    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({
        status: "QUEUED",
        brokerUserId: "broker1",
        tariff: { code: "STANDARD" },
        items: [{ id: "i1" }],
      })
    );
    await expect(
      saveCalculationItems({
        calculationId: "calc1",
        brokerUserId: "broker1",
        items: [{ id: "i1", hsCodeFinal: "8471" }],
      })
    ).rejects.toThrow(/Cannot save items/);

    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({
        status: "IN_REVIEW",
        brokerUserId: "broker1",
        tariff: { code: "STANDARD" },
        items: [{ id: "i1" }],
      })
    );
    await expect(
      saveCalculationItems({
        calculationId: "calc1",
        brokerUserId: "broker1",
        items: [{ id: "synthetic", hsCodeFinal: "8471" }],
      })
    ).rejects.toThrow(/Invalid item id/);
  });
});

describe("approveCalculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.calculationItem.findMany.mockResolvedValue([]);
  });

  it("assigned broker can approve → DONE + PDF", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({
        status: "IN_REVIEW",
        brokerUserId: "broker1",
        tariffId: "t2",
        tariff: { id: "t2", code: "STANDARD", priceRub: 2990, brokerSharePct: 35 },
        items: [{ id: "i1", name: "Ноут" }],
      })
    );
    prismaMock.calculationItem.findMany.mockResolvedValue([
      { id: "i1", name: "Ноут", hsCodeFinal: "8471 30 000 1", dutyRub: 100, vatRub: 200 },
    ]);
    prismaMock.calculation.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "calc1",
      number: "#47901",
      ...data,
    }));
    prismaMock.tariffPlan.findUnique.mockResolvedValue({
      id: "t2",
      priceRub: 2990,
      brokerSharePct: 35,
    });
    prismaMock.brokerProfile.findUnique.mockResolvedValue({ id: "bp1", userId: "broker1" });
    prismaMock.brokerPayout.findFirst.mockResolvedValue(null);
    prismaMock.brokerPayout.create.mockResolvedValue({});

    const result = await approveCalculation({
      calculationId: "calc1",
      brokerUserId: "broker1",
      hsCodeFinal: "8471 30 000 1",
      comment: "ok",
      items: [{ id: "i1", hsCodeFinal: "8471 30 000 1", dutyRub: 100, vatRub: 200 }],
    });

    expect(result.status).toBe("DONE");
    expect(result.hsCodeFinal).toBe("8471 30 000 1");
    expect(result.pdfHtml).toContain("8471 30 000 1");
    expect(prismaMock.brokerPayout.create).toHaveBeenCalled();
  });

  it("approve with items updates payments and PDF table", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({
        status: "IN_REVIEW",
        brokerUserId: "broker1",
        tariffId: "t2",
        tariff: { id: "t2", code: "STANDARD", priceRub: 2990, brokerSharePct: 0 },
        items: [{ id: "i1", name: "Ноут" }],
      })
    );
    prismaMock.calculationItem.findMany.mockResolvedValue([
      {
        id: "i1",
        name: "Ноут",
        hsCodeFinal: "8471 30 000 9",
        dutyRub: 400,
        vatRub: 600,
      },
    ]);
    prismaMock.calculation.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "calc1",
      number: "#47901",
      ...data,
    }));
    prismaMock.tariffPlan.findUnique.mockResolvedValue({
      id: "t2",
      priceRub: 2990,
      brokerSharePct: 0,
    });
    prismaMock.brokerProfile.findUnique.mockResolvedValue(null);

    const result = await approveCalculation({
      calculationId: "calc1",
      brokerUserId: "broker1",
      hsCodeFinal: "8471 30 000 9",
      feeRub: 50,
      items: [{ id: "i1", hsCodeFinal: "8471 30 000 9", dutyRub: 400, vatRub: 600 }],
    });

    expect(prismaMock.calculationItem.update).toHaveBeenCalled();
    expect(result.dutyRub).toBe(400);
    expect(result.vatRub).toBe(600);
    expect(result.totalPaymentsRub).toBe(1050);
    expect(result.pdfHtml).toContain("Сопоставление позиций");
  });

  it("approve includes extraFee in total and PDF", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({
        status: "IN_REVIEW",
        brokerUserId: "broker1",
        extraFeeRub: 0,
        tariffId: "t2",
        tariff: { id: "t2", code: "STANDARD", priceRub: 2990, brokerSharePct: 0 },
        items: [{ id: "i1", name: "Ноут" }],
      })
    );
    prismaMock.calculationItem.findMany.mockResolvedValue([
      {
        id: "i1",
        name: "Ноут",
        description: "Портативная ЭВМ",
        hsCodeFinal: "8471 30 000 9",
        dutyRub: 400,
        vatRub: 600,
      },
    ]);
    prismaMock.calculation.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "calc1",
      number: "#47901",
      ...data,
    }));
    prismaMock.tariffPlan.findUnique.mockResolvedValue({
      id: "t2",
      priceRub: 2990,
      brokerSharePct: 0,
    });
    prismaMock.brokerProfile.findUnique.mockResolvedValue(null);

    const result = await approveCalculation({
      calculationId: "calc1",
      brokerUserId: "broker1",
      hsCodeFinal: "8471 30 000 9",
      feeRub: 50,
      extraFeeRub: 80,
      extraFeeNote: "особый выпуск",
      items: [
        {
          id: "i1",
          hsCodeFinal: "8471 30 000 9",
          dutyRub: 400,
          vatRub: 600,
          description: "Портативная ЭВМ",
        },
      ],
    });

    expect(result.totalPaymentsRub).toBe(400 + 600 + 50 + 80);
    expect(result.pdfHtml).toContain("Портативная ЭВМ");
    expect(result.pdfHtml).toContain("особый выпуск");
    expect(result.extraFeeRub).toBe(80);
  });

  it("rejects synthetic / foreign item ids", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({
        status: "IN_REVIEW",
        brokerUserId: "broker1",
        tariff: { code: "STANDARD" },
        items: [{ id: "i1", name: "Ноут" }],
      })
    );
    await expect(
      approveCalculation({
        calculationId: "calc1",
        brokerUserId: "broker1",
        hsCodeFinal: "8471",
        items: [{ id: "synthetic", hsCodeFinal: "8471" }],
      })
    ).rejects.toThrow(/Invalid item id/);

    await expect(
      approveCalculation({
        calculationId: "calc1",
        brokerUserId: "broker1",
        hsCodeFinal: "8471",
        items: [{ id: "foreign", hsCodeFinal: "8471" }],
      })
    ).rejects.toThrow(/Unknown item id/);
  });

  it("rejects approve with empty items on calc", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({
        status: "IN_REVIEW",
        brokerUserId: "broker1",
        tariff: { code: "STANDARD" },
        items: [],
      })
    );
    await expect(
      approveCalculation({
        calculationId: "calc1",
        brokerUserId: "broker1",
        hsCodeFinal: "8471",
      })
    ).rejects.toThrow(/no items/);
  });

  it("rejects approve by another broker", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue(
      baseCalc({
        status: "IN_REVIEW",
        brokerUserId: "broker1",
        tariff: { code: "STANDARD" },
        items: [{ id: "i1" }],
      })
    );
    await expect(
      approveCalculation({
        calculationId: "calc1",
        brokerUserId: "broker2",
        hsCodeFinal: "8471",
      })
    ).rejects.toThrow(/Forbidden/);
  });
});

describe("runSlaTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("escalates overdue and releases preferred after timeout", async () => {
    prismaMock.calculation.findMany
      .mockResolvedValueOnce([{ id: "c1", number: "#1", status: "QUEUED" }])
      .mockResolvedValueOnce([
        {
          id: "c2",
          number: "#2",
          preferredBrokerUserId: "b1",
          queuedAt: new Date(Date.now() - 20 * 3600_000),
        },
      ]);
    prismaMock.calculation.update.mockResolvedValue({});

    const result = await runSlaTick();
    expect(result.escalated).toBe(1);
    expect(result.releasedPreferred).toBe(1);
    expect(prismaMock.calculation.update).toHaveBeenCalled();
  });
});

describe("createAndDraftCalculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.calculation.count.mockResolvedValue(1);
    prismaMock.calculation.findUnique.mockResolvedValue(null);
    prismaMock.calculationItem.update.mockResolvedValue({});
  });

  it("rejects STANDARD when more than 3 items (D10)", async () => {
    prismaMock.tariffPlan.findUnique.mockResolvedValue({ id: "t2", code: "STANDARD" });

    await expect(
      createAndDraftCalculation({
        clientUserId: "client1",
        companyId: "co1",
        title: "Batch",
        description: "desc long enough",
        tariffCode: "STANDARD",
        items: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }],
      })
    ).rejects.toThrow(/Too many positions/);
    expect(prismaMock.calculation.create).not.toHaveBeenCalled();
  });

  it("rejects explicitly empty items array", async () => {
    prismaMock.tariffPlan.findUnique.mockResolvedValue({ id: "t1", code: "EXPRESS" });
    await expect(
      createAndDraftCalculation({
        clientUserId: "client1",
        companyId: "co1",
        title: "x",
        description: "yyyyy",
        items: [],
      })
    ).rejects.toThrow(/At least one item/);
  });

  it("rejects EXPRESS when more than 1 item (D10)", async () => {
    prismaMock.tariffPlan.findUnique.mockResolvedValue({ id: "t1", code: "EXPRESS" });

    await expect(
      createAndDraftCalculation({
        clientUserId: "client1",
        companyId: "co1",
        title: "One",
        description: "desc long",
        tariffCode: "EXPRESS",
        items: [{ name: "Only" }, { name: "Extra" }],
      })
    ).rejects.toThrow(/Too many positions/);
    expect(prismaMock.calculation.create).not.toHaveBeenCalled();
  });

  it("rejects unpublished manufacturerSkuId (C2)", async () => {
    prismaMock.tariffPlan.findUnique.mockResolvedValue({ id: "t2", code: "STANDARD" });
    prismaMock.manufacturerSku.findFirst.mockResolvedValue(null);

    await expect(
      createAndDraftCalculation({
        clientUserId: "client1",
        companyId: "co1",
        title: "Batch",
        description: "desc long enough",
        tariffCode: "STANDARD",
        items: [{ name: "A", manufacturerSkuId: "sku-draft" }],
      })
    ).rejects.toThrow(/Published SKU not found/);
    expect(prismaMock.calculation.create).not.toHaveBeenCalled();
  });
});

describe("escalateSla", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("QUEUED → SLA_RISK", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue({
      id: "calc1",
      number: "#1",
      status: "QUEUED",
      brokerUserId: null,
    });
    prismaMock.calculation.update.mockResolvedValue({ id: "calc1", status: "SLA_RISK" });

    const row = await escalateSla({
      calculationId: "calc1",
      adminUserId: "admin1",
      actorRole: "ADMIN",
    });
    expect(row.status).toBe("SLA_RISK");
    expect(prismaMock.calculation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "SLA_RISK" },
      })
    );
  });

  it("broker can escalate own IN_REVIEW", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue({
      id: "calc1",
      number: "#1",
      status: "IN_REVIEW",
      brokerUserId: "broker1",
    });
    prismaMock.calculation.update.mockResolvedValue({ id: "calc1", status: "SLA_RISK" });

    const row = await escalateSla({
      calculationId: "calc1",
      adminUserId: "broker1",
      actorRole: "BROKER",
    });
    expect(row.status).toBe("SLA_RISK");
  });

  it("broker cannot escalate another broker job", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue({
      id: "calc1",
      number: "#1",
      status: "IN_REVIEW",
      brokerUserId: "broker1",
    });
    await expect(
      escalateSla({ calculationId: "calc1", adminUserId: "broker2", actorRole: "BROKER" })
    ).rejects.toThrow(/Forbidden/);
  });

  it("rejects escalate from DONE", async () => {
    prismaMock.calculation.findUniqueOrThrow.mockResolvedValue({
      id: "calc1",
      number: "#1",
      status: "DONE",
      brokerUserId: null,
    });
    await expect(
      escalateSla({ calculationId: "calc1", adminUserId: "admin1", actorRole: "ADMIN" })
    ).rejects.toThrow(/Illegal status transition/);
  });
});
