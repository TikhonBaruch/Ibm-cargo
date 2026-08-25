import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  tx: {} as Record<string, unknown>,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: typeof mocks.tx) => Promise<unknown>) => fn(mocks.tx),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tx = {
    calculation: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    calculationEvent: { create: mocks.create },
  };
});

describe("submitClientCalculationFeedback", () => {
  it("stores reaction and appends NOTE event for DONE calc", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "c1",
      clientUserId: "u1",
      status: "DONE",
      clientFeedbackAt: null,
    });
    mocks.update.mockResolvedValue({
      id: "c1",
      status: "DONE",
      clientFeedbackReaction: "HELPFUL",
      clientFeedbackComment: null,
      clientFeedbackAt: new Date("2026-08-14"),
    });

    const { submitClientCalculationFeedback } = await import("../client-feedback");
    const result = await submitClientCalculationFeedback({
      calculationId: "c1",
      clientUserId: "u1",
      input: { reaction: "HELPFUL" },
    });

    expect(result.clientFeedbackReaction).toBe("HELPFUL");
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "NOTE",
          actorUserId: "u1",
          payload: { note: "Клиент: результат полезен" },
        }),
      })
    );
  });

  it("allows reaction after AI_READY draft", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "c1",
      clientUserId: "u1",
      status: "AI_READY",
      clientFeedbackAt: null,
    });
    mocks.update.mockResolvedValue({
      id: "c1",
      status: "AI_READY",
      clientFeedbackReaction: "HELPFUL",
      clientFeedbackComment: null,
      clientFeedbackAt: new Date(),
    });
    const { submitClientCalculationFeedback } = await import("../client-feedback");
    const result = await submitClientCalculationFeedback({
      calculationId: "c1",
      clientUserId: "u1",
      input: { reaction: "HELPFUL" },
    });
    expect(result.clientFeedbackReaction).toBe("HELPFUL");
  });

  it("rejects before AI draft", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "c1",
      clientUserId: "u1",
      status: "DRAFT",
      clientFeedbackAt: null,
    });
    const { submitClientCalculationFeedback } = await import("../client-feedback");
    await expect(
      submitClientCalculationFeedback({
        calculationId: "c1",
        clientUserId: "u1",
        input: { reaction: "NEEDS_WORK", comment: "HS сомнительный" },
      })
    ).rejects.toThrow(/draft is ready/);
  });

  it("rejects duplicate feedback", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "c1",
      clientUserId: "u1",
      status: "DONE",
      clientFeedbackAt: new Date(),
    });
    const { submitClientCalculationFeedback } = await import("../client-feedback");
    await expect(
      submitClientCalculationFeedback({
        calculationId: "c1",
        clientUserId: "u1",
        input: { reaction: "HELPFUL" },
      })
    ).rejects.toThrow(/already submitted/);
  });
});
