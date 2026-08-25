import { describe, expect, it, vi, beforeEach } from "vitest";
import { adjustCompanyBalance, adminCompanyPatchSchema } from "../admin-company";

vi.mock("@/lib/ved/ledger", () => ({
  creditCompany: vi.fn().mockResolvedValue({ id: "le1", balanceAfter: 1500 }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    manufacturerSku: { count: vi.fn() },
    skuOrderRequest: { count: vi.fn() },
    skuOrderPool: { count: vi.fn() },
  },
}));

vi.mock("@/lib/audit", () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

import { creditCompany } from "@/lib/ved/ledger";
import { prisma } from "@/lib/prisma";
import { patchCompanyForAdmin } from "../admin-company";

describe("adjustCompanyBalance", () => {
  it("credits ADJUSTMENT with reason", async () => {
    await adjustCompanyBalance({
      companyId: "co1",
      amountRub: 500,
      reason: "promo credit",
      actorUserId: "admin1",
    });
    expect(creditCompany).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "co1",
        amountRub: 500,
        kind: "ADJUSTMENT",
        createdById: "admin1",
      })
    );
  });

  it("rejects zero amount", async () => {
    await expect(
      adjustCompanyBalance({
        companyId: "co1",
        amountRub: 0,
        reason: "noop",
        actorUserId: "a",
      })
    ).rejects.toThrow(/non-zero/);
  });
});

describe("adminCompanyPatchSchema", () => {
  it("accepts segment + name", () => {
    expect(
      adminCompanyPatchSchema.parse({ name: "ООО Тест", clientSegment: "WHOLESALE" })
    ).toEqual({ name: "ООО Тест", clientSegment: "WHOLESALE" });
  });

  it("rejects unknown keys", () => {
    expect(() => adminCompanyPatchSchema.parse({ kind: "MANUFACTURER" })).toThrow();
  });
});

describe("patchCompanyForAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects clientSegment on MANUFACTURER", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: "m1",
      kind: "MANUFACTURER",
    } as never);
    await expect(
      patchCompanyForAdmin({
        companyId: "m1",
        raw: { clientSegment: "WHOLESALE" },
        actorUserId: "a1",
      })
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/clientSegment/) });
  });

  it("patches CLIENT segment", async () => {
    vi.mocked(prisma.company.findUnique)
      .mockResolvedValueOnce({ id: "c1", kind: "CLIENT" } as never)
      .mockResolvedValueOnce({
        id: "c1",
        kind: "CLIENT",
        name: "Imp",
        clientSegment: "WHOLESALE",
        users: [],
        ledger: [],
        calculations: [],
        _count: { calculations: 0 },
      } as never);
    vi.mocked(prisma.company.update).mockResolvedValue({
      id: "c1",
      kind: "CLIENT",
      clientSegment: "WHOLESALE",
    } as never);

    const view = await patchCompanyForAdmin({
      companyId: "c1",
      raw: { clientSegment: "WHOLESALE" },
      actorUserId: "a1",
      actorName: "Admin",
      actorRole: "ADMIN",
    });
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
        data: expect.objectContaining({ clientSegment: "WHOLESALE" }),
      })
    );
    expect(view?.clientSegment).toBe("WHOLESALE");
  });

  it("rejects empty patch", async () => {
    await expect(
      patchCompanyForAdmin({ companyId: "c1", raw: {}, actorUserId: "a1" })
    ).rejects.toMatchObject({ status: 400 });
  });
});
