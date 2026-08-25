/**
 * Graceful HTTP + Prisma shutdown for containers/api.
 * Mirror of src/lib/ved/graceful-shutdown.ts (D26 / plan-api-sigterm).
 */
export async function runGracefulShutdown(deps, signal = "SIGTERM") {
  const exit = deps.exit || ((code) => process.exit(code));
  const log = deps.log || ((msg) => console.log(msg));
  log(`[api] ${signal} — closing HTTP, disconnecting Prisma`);
  await new Promise((resolve, reject) => {
    deps.server.close((err) => (err ? reject(err) : resolve()));
  });
  await deps.prisma.$disconnect();
  exit(0);
}

export function attachSigtermHandlers(deps, processRef = process) {
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
  return { shutdown, detach: () => {
    processRef.off?.("SIGTERM", onTerm);
    processRef.off?.("SIGINT", onInt);
  } };
}
