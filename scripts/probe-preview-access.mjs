#!/usr/bin/env node
/**
 * Probe Preview / host access for C32 DevEx.
 * Reports SSO block vs reachable /health without writing to DB.
 *
 *   TEST_API_URL=https://<preview>.vercel.app node scripts/probe-preview-access.mjs
 *   VERCEL_AUTOMATION_BYPASS_SECRET=… TEST_API_URL=… node scripts/probe-preview-access.mjs
 */
import { vercelBypassEnabled } from "./lib/install-vercel-bypass.mjs";

const BASE = (process.env.TEST_API_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
if (!BASE) {
  console.error("Set TEST_API_URL to the Preview (or prod) origin");
  process.exit(2);
}

async function main() {
  console.log(`[probe-preview] base=${BASE}`);
  console.log(`[probe-preview] bypass=${vercelBypassEnabled ? "on" : "off"}`);

  const res = await fetch(`${BASE}/health`, { redirect: "manual" });
  const loc = res.headers.get("location") || "";
  const body = await res.text().catch(() => "");

  if (res.status >= 300 && res.status < 400 && /vercel\.com\/(sso|login)/i.test(loc)) {
    console.log(`[probe-preview] SSO_BLOCK status=${res.status} location=${loc.slice(0, 120)}`);
    console.log(
      "[probe-preview] FAIL — Deployment Protection. Visit Preview in browser, or set VERCEL_AUTOMATION_BYPASS_SECRET (C32b)."
    );
    process.exit(1);
  }

  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    /* html or empty */
  }

  if (res.ok && json?.ok === true) {
    console.log(
      `[probe-preview] OK status=${res.status} service=${json.service ?? "?"} databaseUrl=${json.databaseUrl}`
    );
    process.exit(0);
  }

  console.log(`[probe-preview] UNEXPECTED status=${res.status} body=${body.slice(0, 200)}`);
  process.exit(1);
}

main().catch((e) => {
  console.error("[probe-preview]", e);
  process.exit(1);
});
