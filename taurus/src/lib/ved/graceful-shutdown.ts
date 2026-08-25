/**
 * Graceful HTTP + Prisma shutdown (D26). Canon for containers/api SIGTERM/SIGINT.
 * Inject processRef/exit so smoke tests can emit('SIGTERM') without killing vitest.
 */
export type CloseableServer = {
  close: (callback?: (err?: Error | null) => void) => void;
};

export type DisconnectablePrisma = {
  $disconnect: () => Promise<void>;
};

export type GracefulShutdownDeps = {
  server: CloseableServer;
  prisma: DisconnectablePrisma;
  /** Defaults to process.exit — override in tests. */
  exit?: (code: number) => void;
  log?: (msg: string) => void;
};

export type SignalProcess = {
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
  off?: (event: string, listener: (...args: unknown[]) => void) => unknown;
};

function closeServer(server: CloseableServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/** server.close → prisma.$disconnect → exit(0). Idempotent while in flight. */
export async function runGracefulShutdown(
  deps: GracefulShutdownDeps,
  signal = "SIGTERM"
): Promise<void> {
  const exit = deps.exit ?? ((code: number) => process.exit(code));
  const log = deps.log ?? ((msg: string) => console.log(msg));
  log(`[api] ${signal} — closing HTTP, disconnecting Prisma`);
  await closeServer(deps.server);
  await deps.prisma.$disconnect();
  exit(0);
}

/**
 * Register SIGTERM/SIGINT. Returns { shutdown, detach }.
 * `shutdown` is the same path emit('SIGTERM') triggers.
 */
export function attachSigtermHandlers(
  deps: GracefulShutdownDeps,
  processRef: SignalProcess = process
): {
  shutdown: (signal?: string) => Promise<void>;
  detach: () => void;
} {
  let shuttingDown = false;
  const shutdown = async (signal = "SIGTERM") => {
    if (shuttingDown) return;
    shuttingDown = true;
    await runGracefulShutdown(deps, signal);
  };
  const onTerm = () => {
    void shutdown("SIGTERM");
  };
  const onInt = () => {
    void shutdown("SIGINT");
  };
  processRef.on("SIGTERM", onTerm);
  processRef.on("SIGINT", onInt);
  return {
    shutdown,
    detach: () => {
      processRef.off?.("SIGTERM", onTerm);
      processRef.off?.("SIGINT", onInt);
    },
  };
}
