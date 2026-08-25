/**
 * D26 — durable outbox / jobs / service call helpers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimBackgroundJobs,
  claimOutboxBatch,
  completeServiceCall,
  enqueueBackgroundJob,
  enqueueOutbox,
  finishBackgroundJob,
  JOB_KINDS,
  markOutboxDelivered,
  markOutboxFailed,
  OUTBOX_TEMPLATES,
  recordServiceCall,
  retryBackgroundJob,
  retryOutboxMessage,
} from "../orchestration";

type OrchMockDb = {
  serviceOutbox: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  backgroundJob: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  serviceCall: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

function mockDb(overrides: Partial<OrchMockDb> = {}): OrchMockDb {
  return {
    serviceOutbox: {
      create: vi.fn().mockResolvedValue({ id: "obx1", status: "PENDING" }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    backgroundJob: {
      create: vi.fn().mockResolvedValue({ id: "job1", status: "QUEUED" }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    serviceCall: {
      create: vi.fn().mockResolvedValue({ id: "sc1", status: "PENDING" }),
      update: vi.fn().mockResolvedValue({ id: "sc1", status: "OK" }),
    },
    ...overrides,
  };
}

describe("D26 orchestration constants", () => {
  it("exposes known templates and job kinds", () => {
    expect(OUTBOX_TEMPLATES).toContain("calc.approved");
    expect(OUTBOX_TEMPLATES).toContain("ledger.topup");
    expect(OUTBOX_TEMPLATES).toContain("chat.message");
    expect(OUTBOX_TEMPLATES).toContain("chat.support_new");
    expect(OUTBOX_TEMPLATES).toContain("chat.support_reply");
    expect(JOB_KINDS).toContain("SLA_TICK");
    expect(JOB_KINDS).toContain("OUTBOX_DRAIN");
    expect(JOB_KINDS).toContain("AI_DRAIN");
  });
});

describe("enqueueOutbox", () => {
  it("creates PENDING outbox with defaults", async () => {
    const db = mockDb();
    await enqueueOutbox(db as never, {
      template: "calc.approved",
      to: "client@example.com",
      calculationId: "calc1",
      payload: { number: "#1" },
    });
    expect(db.serviceOutbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: "email",
        template: "calc.approved",
        to: "client@example.com",
        status: "PENDING",
        calculationId: "calc1",
        payload: { number: "#1" },
      }),
    });
  });
});

describe("enqueueBackgroundJob", () => {
  it("creates QUEUED job", async () => {
    const db = mockDb();
    await enqueueBackgroundJob(db as never, { kind: "SLA_TICK", payload: { source: "test" } });
    expect(db.backgroundJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "SLA_TICK",
        status: "QUEUED",
        maxAttempts: 5,
        payload: { source: "test" },
      }),
    });
  });
});

describe("recordServiceCall / completeServiceCall", () => {
  it("records PENDING without finishedAt by default", async () => {
    const db = mockDb();
    await recordServiceCall(db as never, {
      service: "ai",
      operation: "draft",
      status: "PENDING",
      calculationId: "calc1",
    });
    expect(db.serviceCall.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        service: "ai",
        operation: "draft",
        status: "PENDING",
        finishedAt: undefined,
      }),
    });
  });

  it("completes call to OK", async () => {
    const db = mockDb();
    await completeServiceCall(db as never, "sc1", { status: "OK", durationMs: 42 });
    expect(db.serviceCall.update).toHaveBeenCalledWith({
      where: { id: "sc1" },
      data: expect.objectContaining({
        status: "OK",
        durationMs: 42,
        finishedAt: expect.any(Date),
      }),
    });
  });
});

describe("claimBackgroundJobs / finishBackgroundJob", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("claims QUEUED → RUNNING via optimistic update", async () => {
    const row = {
      id: "job1",
      kind: "SLA_TICK",
      status: "QUEUED",
      attempts: 0,
    };
    const db = mockDb();
    db.backgroundJob.findMany = vi.fn().mockResolvedValue([row]);
    db.backgroundJob.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    db.backgroundJob.findUnique = vi.fn().mockResolvedValue({
      ...row,
      status: "RUNNING",
      attempts: 1,
      lockedBy: "worker-1",
    });

    const claimed = await claimBackgroundJobs(db as never, { lockedBy: "worker-1", limit: 1 });
    expect(claimed).toHaveLength(1);
    expect(claimed[0].status).toBe("RUNNING");
    expect(db.backgroundJob.updateMany).toHaveBeenCalledWith({
      where: { id: "job1", status: "QUEUED" },
      data: expect.objectContaining({
        status: "RUNNING",
        lockedBy: "worker-1",
      }),
    });
  });

  it("finish ok → DONE; fail retries then DEAD", async () => {
    const db = mockDb();
    db.backgroundJob.update = vi.fn().mockResolvedValue({});

    await finishBackgroundJob(db as never, "job1", { ok: true, result: { ok: true } });
    expect(db.backgroundJob.update).toHaveBeenCalledWith({
      where: { id: "job1" },
      data: expect.objectContaining({ status: "DONE" }),
    });

    await finishBackgroundJob(db as never, "job1", {
      ok: false,
      error: "boom",
      attempts: 2,
      maxAttempts: 5,
    });
    expect(db.backgroundJob.update).toHaveBeenLastCalledWith({
      where: { id: "job1" },
      data: expect.objectContaining({ status: "QUEUED", lastError: "boom" }),
    });

    await finishBackgroundJob(db as never, "job1", {
      ok: false,
      error: "boom",
      attempts: 5,
      maxAttempts: 5,
    });
    expect(db.backgroundJob.update).toHaveBeenLastCalledWith({
      where: { id: "job1" },
      data: expect.objectContaining({ status: "DEAD" }),
    });
  });
});

describe("claimOutboxBatch / markOutbox*", () => {
  it("claims PENDING → SENDING", async () => {
    const row = { id: "obx1", status: "PENDING", attempts: 0 };
    const db = mockDb();
    db.serviceOutbox.findMany = vi.fn().mockResolvedValue([row]);
    db.serviceOutbox.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    db.serviceOutbox.findUnique = vi
      .fn()
      .mockResolvedValue({ ...row, status: "SENDING", attempts: 1 });

    const claimed = await claimOutboxBatch(db as never, { limit: 1 });
    expect(claimed).toHaveLength(1);
    expect(claimed[0].status).toBe("SENDING");
  });

  it("delivered vs failed/dead", async () => {
    const db = mockDb();
    db.serviceOutbox.update = vi.fn().mockResolvedValue({});

    await markOutboxDelivered(db as never, "obx1");
    expect(db.serviceOutbox.update).toHaveBeenCalledWith({
      where: { id: "obx1" },
      data: expect.objectContaining({ status: "DELIVERED" }),
    });

    await markOutboxFailed(db as never, "obx1", "smtp down", 2);
    expect(db.serviceOutbox.update).toHaveBeenLastCalledWith({
      where: { id: "obx1" },
      data: expect.objectContaining({ status: "FAILED" }),
    });

    await markOutboxFailed(db as never, "obx1", "smtp down", 5);
    expect(db.serviceOutbox.update).toHaveBeenLastCalledWith({
      where: { id: "obx1" },
      data: expect.objectContaining({ status: "DEAD" }),
    });
  });
});

describe("admin retry", () => {
  it("requeues FAILED job", async () => {
    const db = mockDb();
    db.backgroundJob.findUnique = vi.fn().mockResolvedValue({
      id: "j1",
      status: "FAILED",
    });
    db.backgroundJob.update = vi.fn().mockResolvedValue({ id: "j1", status: "QUEUED" });
    await retryBackgroundJob(db as never, "j1");
    expect(db.backgroundJob.update).toHaveBeenCalledWith({
      where: { id: "j1" },
      data: expect.objectContaining({ status: "QUEUED", attempts: 0 }),
    });
  });

  it("rejects retry of QUEUED job", async () => {
    const db = mockDb();
    db.backgroundJob.findUnique = vi.fn().mockResolvedValue({ id: "j1", status: "QUEUED" });
    await expect(retryBackgroundJob(db as never, "j1")).rejects.toThrow(/Cannot retry/);
  });

  it("requeues FAILED outbox and enqueues OUTBOX_DRAIN", async () => {
    const db = mockDb();
    db.serviceOutbox.findUnique = vi.fn().mockResolvedValue({ id: "o1", status: "FAILED" });
    db.serviceOutbox.update = vi.fn().mockResolvedValue({ id: "o1", status: "PENDING" });
    await retryOutboxMessage(db as never, "o1");
    expect(db.serviceOutbox.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: expect.objectContaining({ status: "PENDING", attempts: 0 }),
    });
    expect(db.backgroundJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "OUTBOX_DRAIN", status: "QUEUED" }),
    });
  });
});
