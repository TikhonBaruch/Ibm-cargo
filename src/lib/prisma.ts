import { PrismaClient } from "@prisma/client";
import { readDatabaseUrl } from "./db-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = readDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return new PrismaClient({
    datasourceUrl: url,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

/** Lazy: importing this module must not require DATABASE_URL (NextAuth, tests). */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    // PrismaClient is thenable; a proxy that forwards `then` breaks `await prisma`.
    if (prop === "then") return undefined;
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
