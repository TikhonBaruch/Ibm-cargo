import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../calculations", () => ({
  runSlaTick: vi.fn().mockResolvedValue({ expired: 0, warned: 0 }),
}));
vi.mock("../outbox-drain", () => ({
  drainServiceOutbox: vi.fn().mockResolvedValue({ claimed: 0, delivered: 0, failed: 0 }),
}));
vi.mock("../ai-pipeline", () => ({
  finishQueuedAiDrainForCalc: vi.fn().mockResolvedValue({ ok: true, hsCode: "6109" }),
}));
vi.mock("../orchestration", () => ({
  claimBackgroundJobs: vi.fn(),
  finishBackgroundJob: vi.fn().mockResolvedValue({}),
}));

import { finishQueuedAiDrainForCalc } from "../ai-pipeline";
import { runSlaTick } from "../calculations";
import { claimBackgroundJobs, finishBackgroundJob } from "../orchestration";
import { drainServiceOutbox } from "../outbox-drain";
import { runJobsTick } from "../jobs-tick";

describe("runJobsTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs sla + outbox and finishes claimed AI_DRAIN via finishQueued", async () => {
    vi.mocked(claimBackgroundJobs)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "job-1",
          kind: "AI_DRAIN",
          calculationId: "calc-1",
          payload: {},
          attempts: 1,
          maxAttempts: 6,
        } as never,
      ]);

    const out = await runJobsTick({} as never, { lockedBy: "test" });

    expect(runSlaTick).toHaveBeenCalled();
    expect(drainServiceOutbox).toHaveBeenCalled();
    expect(finishQueuedAiDrainForCalc).toHaveBeenCalledWith({}, "calc-1");
    expect(out.aiDrain.claimed).toBe(1);
    expect(out.aiDrain.results[0]?.ok).toBe(true);
  });

  it("fails AI_DRAIN without calculationId", async () => {
    vi.mocked(claimBackgroundJobs)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "job-2",
          kind: "AI_DRAIN",
          calculationId: null,
          payload: {},
          attempts: 1,
          maxAttempts: 6,
        } as never,
      ]);

    const out = await runJobsTick({} as never);
    expect(finishQueuedAiDrainForCalc).not.toHaveBeenCalled();
    expect(finishBackgroundJob).toHaveBeenCalledWith(
      {},
      "job-2",
      expect.objectContaining({ ok: false })
    );
    expect(out.aiDrain.results[0]?.ok).toBe(false);
  });
});
