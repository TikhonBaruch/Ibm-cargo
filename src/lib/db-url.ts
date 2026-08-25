/**
 * Read DATABASE_URL at runtime.
 * Use bracket access so Next does not inline a build-time empty value
 * while Prisma's query engine still looks at the real env (or vice versa).
 */
import type { EnvBag } from "./env-bag";
export function readDatabaseUrl(env: EnvBag = process.env): string {
  return String(env["DATABASE_URL"] ?? "").trim();
}

export function isMissingDatabaseUrlError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /DATABASE_URL/i.test(msg);
}
