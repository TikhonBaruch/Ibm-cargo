import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, transactionMock } = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    company: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    ledgerEntry: {
      create: vi.fn(),
    },
    calculation: {
      update: vi.fn(),
    },
  };
  return {
    tx,
    transactionMock: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

import { creditCompany } from "../ledger";

describe("creditCompany", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
    tx.$executeRaw.mockResolvedValue(undefined);
  });

  it("locks company row, credits balance and writes ledger row", async () => {
    tx.company.findUniqueOrThrow.mockResolvedValue({ id: "c1", balanceRub: 1000 });
    tx.company.update.mockResolvedValue({});
    tx.ledgerEntry.create.mockImplementation(async ({ data }: { data: unknown }) => data);

    const entry = await creditCompany({
      companyId: "c1",
      amountRub: 500,
      kind: "TOPUP",
      description: "mock",
    });

    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.company.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { balanceRub: 1500 },
    });
    expect(entry).toMatchObject({
      companyId: "c1",
      amountRub: 500,
      balanceAfter: 1500,
      kind: "TOPUP",
    });
  });

  it("runs after() in the same transaction", async () => {
    tx.company.findUniqueOrThrow.mockResolvedValue({ id: "c1", balanceRub: 5000 });
    tx.company.update.mockResolvedValue({});
    tx.ledgerEntry.create.mockResolvedValue({ id: "le1", balanceAfter: 4010 });
    tx.calculation.update.mockResolvedValue({ id: "calc1", status: "QUEUED" });

    const updated = await creditCompany({
      companyId: "c1",
      amountRub: -990,
      kind: "TARIFF_CHARGE",
      description: "pay",
      after: async (inner) =>
        inner.calculation.update({
          where: { id: "calc1" },
          data: { status: "QUEUED" },
        }),
    });

    expect(updated).toMatchObject({ id: "calc1", status: "QUEUED" });
    expect(tx.calculation.update).toHaveBeenCalled();
  });

  it("rejects zero amount", async () => {
    await expect(
      creditCompany({
        companyId: "c1",
        amountRub: 0,
        kind: "TOPUP",
        description: "x",
      })
    ).rejects.toThrow(/non-zero/i);
  });

  it("rejects insufficient balance on charge", async () => {
    tx.company.findUniqueOrThrow.mockResolvedValue({ id: "c1", balanceRub: 100 });

    await expect(
      creditCompany({
        companyId: "c1",
        amountRub: -500,
        kind: "TARIFF_CHARGE",
        description: "pay",
      })
    ).rejects.toThrow(/Insufficient balance/);

    expect(tx.company.update).not.toHaveBeenCalled();
  });
});
