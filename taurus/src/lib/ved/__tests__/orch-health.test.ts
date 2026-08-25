/**
 * D26 orch health aggregate + classifyServiceError.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyServiceError } from "../orchestration";
import { getOrchestrationHealth } from "../orch-health";

describe("classifyServiceError", () => {
  it("maps abort/timeout to TIMEOUT", () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(classifyServiceError(abort)).toBe("TIMEOUT");
    const to = new Error("Timeout");
    to.name = "TimeoutError";
    expect(classifyServiceError(to)).toBe("TIMEOUT");
    expect(classifyServiceError(new Error("request timed out"))).toBe("TIMEOUT");
  });

  it("maps other errors to FAILED", () => {
    expect(classifyServiceError(new Error("connection refused"))).toBe("FAILED");
    expect(classifyServiceError("x")).toBe("FAILED");
  });
});

describe("getOrchestrationHealth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("aggregates calls/outbox and probes configured deps", async () => {
    vi.stubEnv("PAYMENTS_SERVICE_URL", "http://payments:4300");
    vi.stubEnv("LLM_SERVICE_URL", "");
    vi.stubEnv("AI_SERVICE_URL", "");
    vi.stubEnv("NOTIFY_SERVICE_URL", "");
    vi.stubEnv("LOGISTICS_SERVICE_URL", "");
    vi.stubEnv("OCR_SERVICE_URL", "");

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const db = {
      serviceCall: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "sc1",
            service: "payments",
            operation: "checkout",
            status: "OK",
            error: null,
            durationMs: 40,
            createdAt: new Date(),
          },
          {
            id: "sc2",
            service: "payments",
            operation: "checkout",
            status: "TIMEOUT",
            error: "timeout",
            durationMs: 8000,
            createdAt: new Date(),
          },
        ]),
      },
      serviceOutbox: {
        groupBy: vi.fn().mockResolvedValue([{ status: "PENDING", _count: { _all: 2 } }]),
      },
    };

    const health = await getOrchestrationHealth(db as never, { windowMinutes: 15 });

    expect(health.windowMinutes).toBe(15);
    expect(health.calls.total).toBe(2);
    expect(health.calls.byStatus.OK).toBe(1);
    expect(health.calls.byStatus.TIMEOUT).toBe(1);
    expect(health.calls.byService.payments.timeout).toBe(1);
    expect(health.calls.byService.payments.avgDurationMs).toBe(4020);
    expect(health.outbox.pending).toBe(2);
    expect(health.deps.find((d) => d.service === "payments")).toMatchObject({
      configured: true,
      ok: true,
    });
    expect(health.deps.find((d) => d.service === "llm")).toMatchObject({
      configured: false,
      ok: null,
    });
    expect(health.deps.map((d) => d.service)).toEqual(
      expect.arrayContaining(["payments", "llm", "ai", "notify", "logistics", "ocr"])
    );
    expect(health.deps.find((d) => d.service === "ocr")).toMatchObject({
      configured: false,
      ok: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://payments:4300/health",
      expect.objectContaining({ method: "GET" })
    );
    expect(health.ok).toBe(true);
  });

  it("marks ok=false when configured dep is down", async () => {
    vi.stubEnv("PAYMENTS_SERVICE_URL", "http://payments:4300");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const db = {
      serviceCall: { findMany: vi.fn().mockResolvedValue([]) },
      serviceOutbox: { groupBy: vi.fn().mockResolvedValue([]) },
    };

    const health = await getOrchestrationHealth(db as never);
    expect(health.ok).toBe(false);
    expect(health.deps[0].ok).toBe(false);
  });
});
