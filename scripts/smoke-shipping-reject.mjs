#!/usr/bin/env node
/**
 * D-SHIP hard reject: POST /api/v1/shipping for non-DONE calc → 400.
 *
 *   npm run smoke:shipping
 *   TEST_API_URL=http://localhost:3000 npm run smoke:shipping
 */
import "./lib/install-vercel-bypass.mjs";
const BASE = process.env.TEST_API_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const CLIENT_EMAIL = process.env.CLIENT_EMAIL || "client@example.com";
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD || "demo1234";

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

async function login(email, password) {
  const jar = new Map();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  cookieJar(csrfRes, jar);
  const { csrfToken } = await csrfRes.json();
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(jar),
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      json: "true",
      callbackUrl: `${BASE}/cabinet`,
    }),
    redirect: "manual",
  });
  cookieJar(loginRes, jar);
  if (![200, 302].includes(loginRes.status)) {
    throw new Error(`Login failed: ${loginRes.status}`);
  }
  return jar;
}

async function main() {
  console.log("Smoke shipping pre-DONE reject against", BASE);
  const jar = await login(CLIENT_EMAIL, CLIENT_PASSWORD);
  const headers = {
    Cookie: cookieHeader(jar),
    "Content-Type": "application/json",
  };

  const listRes = await fetch(`${BASE}/api/v1/calculations`, { headers });
  const list = await listRes.json();
  const calcs = Array.isArray(list) ? list : list.items || list.calculations || [];
  const preDone = calcs.find((c) =>
    ["AI_READY", "AWAITING_PAYMENT", "QUEUED", "IN_REVIEW", "SLA_RISK", "DRAFT", "AI_PROCESSING"].includes(
      c.status
    )
  );
  if (!preDone) {
    const createRes = await fetch(`${BASE}/api/v1/calculations`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "Smoke shipping reject",
        tariffCode: "STANDARD",
        items: [{
          name: "Тестовый ноутбук",
          qty: 1,
          unitPrice: 1000,
          attrs: { originCountry: "CN", manufacturerName: "Smoke Factory LLC", composition: "aluminium, plastics" },
        }],
      }),
    });
    const created = await createRes.json();
    if (!createRes.ok || !created.id) {
      throw new Error(`create failed: ${createRes.status} ${JSON.stringify(created)}`);
    }
    if (created.status === "DONE") {
      throw new Error("Unexpected DONE after create — cannot assert pre-DONE reject");
    }
    var calcId = created.id;
    var status = created.status;
  } else {
    var calcId = preDone.id;
    var status = preDone.status;
  }

  console.log(`  using calc ${calcId} status=${status}`);
  const shipRes = await fetch(`${BASE}/api/v1/shipping`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      calculationId: calcId,
      origin: "Шанхай",
      destination: "Москва",
      mode: "LCL",
    }),
  });
  const shipBody = await shipRes.json().catch(() => ({}));
  if (shipRes.status !== 400) {
    throw new Error(`Expected 400, got ${shipRes.status} ${JSON.stringify(shipBody)}`);
  }
  if (!String(shipBody.error || "").includes("Shipping only after DONE")) {
    throw new Error(`Expected DONE-only error, got ${JSON.stringify(shipBody)}`);
  }
  console.log("  pre-DONE → 400 OK");
  console.log("Smoke shipping reject OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
