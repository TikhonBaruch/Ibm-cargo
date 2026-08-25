import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, transactionMock } = vi.hoisted(() => {
  const tx = {
    company: { create: vi.fn() },
    user: { create: vi.fn() },
  };
  return {
    tx,
    transactionMock: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    $transaction: transactionMock,
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed") },
}));

import { prisma } from "@/lib/prisma";
import { registerClient } from "../register";

describe("registerClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    tx.company.create.mockResolvedValue({
      id: "co1",
      name: "Test Co",
      balanceRub: 0,
    });
    tx.user.create.mockResolvedValue({
      id: "u1",
      name: "Ivan",
      email: "ivan@test.com",
      role: "CLIENT",
      companyId: "co1",
    });
  });

  it("creates company and CLIENT user in transaction", async () => {
    const result = await registerClient({
      companyName: "Test Co",
      name: "Ivan",
      email: "Ivan@Test.com",
      password: "secret1",
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "ivan@test.com" },
    });
    expect(tx.company.create).toHaveBeenCalled();
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: "CLIENT",
          companyId: "co1",
          password: "hashed",
        }),
      })
    );
    expect(result.user.id).toBe("u1");
    expect(result.company.balanceRub).toBe(0);
  });

  it("rejects duplicate email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "x" } as never);
    await expect(
      registerClient({
        companyName: "Co",
        name: "A",
        email: "a@b.com",
        password: "123456",
      })
    ).rejects.toThrow(/already registered/);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejects short password", async () => {
    await expect(
      registerClient({
        companyName: "Co",
        name: "A",
        email: "a@b.com",
        password: "123",
      })
    ).rejects.toThrow(/6 characters/);
  });
});
