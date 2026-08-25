import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { attachWorkerSignals, startWorker, stopWorker } from "../worker";

describe("stopWorker (intervals + in-flight logistics)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clears every setInterval so ticks do not run after stop", async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    const sla = vi.fn(async () => undefined);
    const logistics = vi.fn(async () => undefined);
    const aiDrain = vi.fn(async () => undefined);

    const worker = startWorker({
      intervalMs: 1_000,
      ticks: { sla, logistics, aiDrain },
    });
    expect(worker.timerIds).toHaveLength(3);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sla).toHaveBeenCalledTimes(1);
    expect(logistics).toHaveBeenCalledTimes(1);
    expect(aiDrain).toHaveBeenCalledTimes(1);

    const ids = [...worker.timerIds];
    await stopWorker(worker);

    expect(clearSpy).toHaveBeenCalledTimes(3);
    for (const id of ids) {
      expect(clearSpy).toHaveBeenCalledWith(id);
    }
    expect(worker.timerIds).toHaveLength(0);
    expect(worker.stopped).toBe(true);

    sla.mockClear();
    logistics.mockClear();
    aiDrain.mockClear();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(sla).not.toHaveBeenCalled();
    expect(logistics).not.toHaveBeenCalled();
    expect(aiDrain).not.toHaveBeenCalled();
  });

  it("lets an in-flight logistics tick finish before stopWorker resolves", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const logisticsDone = vi.fn();
    const logistics = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = () => {
            logisticsDone();
            resolve();
          };
        })
    );

    const worker = startWorker({ intervalMs: 500, ticks: { logistics } });
    await vi.advanceTimersByTimeAsync(500);
    expect(logistics).toHaveBeenCalledTimes(1);
    expect(worker.inFlight.size).toBe(1);

    let stopResolved = false;
    const stopping = stopWorker(worker).then(() => {
      stopResolved = true;
    });

    await Promise.resolve();
    expect(stopResolved).toBe(false);
    expect(logisticsDone).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(logistics).toHaveBeenCalledTimes(1);

    release();
    await stopping;
    expect(stopResolved).toBe(true);
    expect(logisticsDone).toHaveBeenCalledTimes(1);
    expect(worker.inFlight.size).toBe(0);
  });

  it("SIGTERM triggers stopWorker and clears timers", async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    const logistics = vi.fn(async () => undefined);
    const worker = startWorker({ intervalMs: 2_000, ticks: { logistics } });
    const proc = new EventEmitter();
    const detach = attachWorkerSignals(worker, proc);

    proc.emit("SIGTERM");
    await Promise.resolve();
    expect(worker.stopped).toBe(true);
    expect(clearSpy).toHaveBeenCalled();
    expect(worker.timerIds).toHaveLength(0);

    logistics.mockClear();
    await vi.advanceTimersByTimeAsync(6_000);
    expect(logistics).not.toHaveBeenCalled();
    detach();
  });
});
