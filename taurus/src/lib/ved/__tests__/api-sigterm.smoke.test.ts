/**
 * Smoke: containers/api SIGTERM path.
 * Simulates process.emit('SIGTERM') without killing the test runner
 * (exit injected). Asserts server.close → prisma.$disconnect → exit(0).
 */
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { attachSigtermHandlers } from "../graceful-shutdown";

describe("api SIGTERM smoke (process.emit)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closes HTTP, disconnects Prisma, exits 0", async () => {
    const closeOrder: string[] = [];
    const server = {
      close: vi.fn((cb?: (err?: Error | null) => void) => {
        closeOrder.push("server.close");
        cb?.();
      }),
    };
    const prisma = {
      $disconnect: vi.fn(async () => {
        closeOrder.push("prisma.$disconnect");
      }),
    };
    const exit = vi.fn((code: number) => {
      closeOrder.push(`exit:${code}`);
    });
    const proc = new EventEmitter();

    const { detach } = attachSigtermHandlers(
      { server, prisma, exit, log: () => undefined },
      proc
    );

    proc.emit("SIGTERM");

    await vi.waitFor(() => {
      expect(exit).toHaveBeenCalledWith(0);
    });

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(closeOrder).toEqual(["server.close", "prisma.$disconnect", "exit:0"]);

    detach();
  });

  it("ignores a second SIGTERM while shutdown is in flight", async () => {
    let releaseClose!: () => void;
    const server = {
      close: vi.fn((cb?: (err?: Error | null) => void) => {
        void new Promise<void>((resolve) => {
          releaseClose = () => {
            resolve();
            cb?.();
          };
        });
      }),
    };
    const prisma = { $disconnect: vi.fn(async () => undefined) };
    const exit = vi.fn();
    const proc = new EventEmitter();

    attachSigtermHandlers({ server, prisma, exit, log: () => undefined }, proc);

    proc.emit("SIGTERM");
    proc.emit("SIGTERM");
    expect(server.close).toHaveBeenCalledTimes(1);

    releaseClose();
    await vi.waitFor(() => {
      expect(exit).toHaveBeenCalledWith(0);
    });
    expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
  });
});
