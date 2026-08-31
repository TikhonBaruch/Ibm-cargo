#!/usr/bin/env node
/**
 * Smoke payments (D-LEDGER): login → topup stub → balance↑ → (optional) pay EXPRESS.
 *
 * With PAYMENTS_SERVICE_URL on the app, stub checkout auto-confirms via webhook.
 * Without it, mock topup (ALLOW_MOCK_TOPUP) is used.
 *
 *   npm run smoke:payments
 *   TEST_API_URL=http://localhost:3000 npm run smoke:payments
 */
import "./lib/install-vercel-bypass.mjs";
const BASE = process.env.TEST_API_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const EMAIL = process.env.CLIENT_EMAIL || "client@example.com";
const PASSWORD = process.env.CLIENT_PASSWORD || "demo1234";
const AMOUNT = Number(process.env.SMOKE_TOPUP_AMOUNT || 1500);

function cookieJar(res, jar) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  const single = res.headers.get("set-cookie");
  if (single && raw.length === 0) {
    const [pair] = single.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function withRetry(label, fn, attempts = 4) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e?.message || String(e);
      if (i < attempts && /terminated|fetch failed|ECONNRESET|Login failed/i.test(msg)) {
        console.log(`   retry ${label} (${i}/${attempts}):`, msg.slice(0, 80));
        await new Promise((r) => setTimeout(r, 900 * i));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function main() {
  console.log("Smoke payments against", BASE);

  const jar = await withRetry("login", async () => {
    const j = new Map();
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
    cookieJar(csrfRes, j);
    const { csrfToken } = await csrfRes.json();

    const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieHeader(j),
      },
      body: new URLSearchParams({
        csrfToken,
        email: EMAIL,
        password: PASSWORD,
        json: "true",
        callbackUrl: `${BASE}/cabinet/balance`,
      }),
      redirect: "manual",
    });
    cookieJar(loginRes, j);
    if (![200, 302].includes(loginRes.status)) {
      throw new Error(`Login failed: ${loginRes.status}`);
    }
    return j;
  });

  const headers = { Cookie: cookieHeader(jar), "Content-Type": "application/json" };

  const meBefore = await withRetry("me-before", () =>
    fetch(`${BASE}/api/v1/me`, { headers }).then(async (r) => {
      if (!r.ok) throw new Error(`me: ${r.status}`);
      return r.json();
    })
  );
  const bal0 = meBefore?.company?.balanceRub ?? 0;
  console.log("Balance before", bal0);

  const topup = await withRetry("topup", () =>
    fetch(`${BASE}/api/v1/company/topup`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amountRub: AMOUNT, method: "stub" }),
    }).then(async (r) => {
      const body = await r.json();
      if (!r.ok) throw new Error(`Topup: ${r.status} ${JSON.stringify(body)}`);
      return body;
    })
  );
  if (topup.pending) {
    console.log("Pending acquiring (YooKassa) — confirmUrl present:", !!topup.confirmUrl);
    if (!topup.intentId) throw new Error("Pending topup missing intentId");
    console.log("OK smoke:payments (pending path, intent", topup.intentId, ")");
    return;
  }

  if (!topup.entry && topup.provider !== "mock") {
    throw new Error(`Expected ledger entry after stub/mock topup: ${JSON.stringify(topup)}`);
  }

  const meAfter = await fetch(`${BASE}/api/v1/me`, { headers }).then((r) => r.json());
  const bal1 = meAfter?.company?.balanceRub ?? 0;
  if (bal1 < bal0 + AMOUNT) {
    throw new Error(`Balance not increased: ${bal0} → ${bal1}, expected +${AMOUNT}`);
  }
  console.log("Balance after", bal1, `(+${bal1 - bal0}) provider=${topup.provider} intent=${topup.intentId || "n/a"}`);

  // Idempotent second topup with same flow should still credit a new intent (new row)
  const topup2 = await fetch(`${BASE}/api/v1/company/topup`, {
    method: "POST",
    headers,
    body: JSON.stringify({ amountRub: 100, method: "stub" }),
  }).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(`Topup2: ${r.status} ${JSON.stringify(body)}`);
    return body;
  });
  if (topup2.pending) {
    console.log("OK smoke:payments (second pending)");
    return;
  }

  console.log("OK smoke:payments");
}

main().catch((e) => {
  console.error("FAIL", e.message || e);
  process.exit(1);
});
