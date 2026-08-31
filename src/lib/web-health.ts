import { readDatabaseUrl } from "./db-url";

/** Compose/gateway liveness. Extra flags are runtime-only (never prerender). */
export function webHealthPayload(env: NodeJS.ProcessEnv = process.env): {
  ok: true;
  service: "web";
  databaseUrl: boolean;
} {
  return {
    ok: true,
    service: "web",
    databaseUrl: Boolean(readDatabaseUrl(env)),
  };
}
