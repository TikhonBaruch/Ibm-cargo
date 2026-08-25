/**
 * Interval worker lifecycle (D26 orch). Used by unit tests and mirrored in
 * containers/worker: stop clears setInterval handles and waits in-flight ticks
 * (including logistics) instead of aborting them.
 */
export type WorkerTick = () => Promise<unknown> | unknown;

export type WorkerTicks = {
  sla?: WorkerTick;
  logistics?: WorkerTick;
  aiDrain?: WorkerTick;
};

export type WorkerTimers = {
  setInterval: typeof setInterval;
  clearInterval: typeof clearInterval;
};

export type WorkerInstance = {
  stopped: boolean;
  timerIds: ReturnType<typeof setInterval>[];
  inFlight: Set<Promise<unknown>>;
  timers: WorkerTimers;
};

function nativeTimers(): WorkerTimers {
  return {
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
  };
}

function runTracked(worker: WorkerInstance, tick: WorkerTick): void {
  if (worker.stopped) return;
  let settle!: () => void;
  const gate = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const work = Promise.resolve()
    .then(tick)
    .catch(() => undefined)
    .finally(settle);
  worker.inFlight.add(gate);
  void gate.then(() => {
    worker.inFlight.delete(gate);
  });
  void work;
}

export function startWorker(opts: {
  intervalMs: number;
  ticks: WorkerTicks;
  timers?: WorkerTimers;
}): WorkerInstance {
  const timers = opts.timers ?? nativeTimers();
  const worker: WorkerInstance = {
    stopped: false,
    timerIds: [],
    inFlight: new Set(),
    timers,
  };
  const ms = Math.max(1, opts.intervalMs);
  const entries: Array<WorkerTick | undefined> = [
    opts.ticks.sla,
    opts.ticks.logistics,
    opts.ticks.aiDrain,
  ];
  for (const tick of entries) {
    if (!tick) continue;
    const id = timers.setInterval(() => runTracked(worker, tick), ms);
    worker.timerIds.push(id);
  }
  return worker;
}

/** Clear every setInterval and wait for ticks already in flight (logistics included). */
export async function stopWorker(worker: WorkerInstance): Promise<void> {
  if (worker.stopped) {
    await Promise.allSettled([...worker.inFlight]);
    return;
  }
  worker.stopped = true;
  for (const id of worker.timerIds) {
    worker.timers.clearInterval(id);
  }
  worker.timerIds = [];
  await Promise.allSettled([...worker.inFlight]);
}

type SignalProc = {
  on: (event: string, listener: () => void) => unknown;
  off?: (event: string, listener: () => void) => unknown;
};

/** SIGTERM / SIGINT → stopWorker. Returns unsubscribe. */
export function attachWorkerSignals(worker: WorkerInstance, proc: SignalProc): () => void {
  const onSignal = () => {
    void stopWorker(worker);
  };
  proc.on("SIGTERM", onSignal);
  proc.on("SIGINT", onSignal);
  return () => {
    proc.off?.("SIGTERM", onSignal);
    proc.off?.("SIGINT", onSignal);
  };
}
