#!/usr/bin/env node
/**
 * S5 smoke: POST /api/v1/internal/sla-tick — 401 without key, 200 + shape with key.
 *
 *   npm run smoke:sla
 *   TEST_API_URL=http://localhost:3000 INTERNAL_API_KEY=dev-secret-change-me npm run smoke:sla
 */
const BASE = process.env.TEST_API_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const KEY =
  process.env.INTERNAL_API_KEY ||
  process.env.CRON_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "dev-secret-change-me";

async function main() {
  console.log("Smoke SLA tick against", BASE);

  const unauth = await fetch(`${BASE}/api/v1/internal/sla-tick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (unauth.status !== 401) {
    throw new Error(`Expected 401 without key, got ${unauth.status}`);
  }
  console.log("  unauthorized → 401 OK");

  const res = await fetch(`${BASE}/api/v1/internal/sla-tick`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": KEY,
    },
    body: "{}",
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    throw new Error(
      `Unauthorized (401) with key. Set INTERNAL_API_KEY / CRON_SECRET / NEXTAUTH_SECRET to match the app. Body: ${JSON.stringify(data)}`
    );
  }
  if (!res.ok) {
    throw new Error(`sla-tick failed: ${res.status} ${JSON.stringify(data)}`);
  }

  if (typeof data.escalated !== "number" || typeof data.releasedPreferred !== "number") {
    throw new Error(`Unexpected sla-tick shape: ${JSON.stringify(data)}`);
  }
  if (data.escalated < 0 || data.releasedPreferred < 0) {
    throw new Error(`Negative counts: ${JSON.stringify(data)}`);
  }
  if (!data.at || Number.isNaN(Date.parse(data.at))) {
    throw new Error(`slaTickResult.at missing/invalid: ${JSON.stringify(data)}`);
  }

  console.log("OK sla-tick", {
    escalated: data.escalated,
    releasedPreferred: data.releasedPreferred,
    at: data.at,
  });

  const apiBase = (process.env.API_SERVICE_URL || process.env.DOMAIN_API_URL || "").replace(/\/$/, "");
  if (apiBase) {
    const apiRes = await fetch(`${apiBase}/v1/internal/sla-tick`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": KEY,
      },
      body: "{}",
    });
    const apiData = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok) {
      throw new Error(`api sla-tick failed: ${apiRes.status} ${JSON.stringify(apiData)}`);
    }
    console.log("OK containers/api sla-tick");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
