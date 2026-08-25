#!/usr/bin/env node
/**
 * Phase 0 smoke (client): login → list/create → pay AI_READY → PDF or QUEUED.
 *
 *   node scripts/smoke-client-path.mjs
 *   TEST_API_URL=https://ibm-cargo.vercel.app node scripts/smoke-client-path.mjs
 */
const BASE = process.env.TEST_API_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const EMAIL = process.env.CLIENT_EMAIL || "client@example.com";
const PASSWORD = process.env.CLIENT_PASSWORD || "demo1234";

function cookieJar(res, jar) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  const jar = new Map();
  console.log("Smoke client path against", BASE);

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
      email: EMAIL,
      password: PASSWORD,
      json: "true",
      callbackUrl: `${BASE}/cabinet`,
    }),
    redirect: "manual",
  });
  cookieJar(loginRes, jar);
  if (![200, 302].includes(loginRes.status)) {
    throw new Error(`Login failed: ${loginRes.status}`);
  }

  const headers = { Cookie: cookieHeader(jar), "Content-Type": "application/json" };

  const list = await fetch(`${BASE}/api/v1/calculations`, { headers }).then((r) => r.json());
  if (!Array.isArray(list)) throw new Error(`List error: ${JSON.stringify(list)}`);

  let target = list.find((c) => c.number === "#SEED-READY" && ["AI_READY", "AWAITING_PAYMENT"].includes(c.status));
  if (!target) {
    target = list.find((c) => ["AI_READY", "AWAITING_PAYMENT"].includes(c.status));
  }

  if (!target) {
    console.log("No AI_READY seed — creating EXPRESS calc…");
    const created = await fetch(`${BASE}/api/v1/calculations`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "Smoke client item",
        description: "Smoke path multi-item create",
        country: "CN",
        shipmentValue: "1000",
        tariffCode: "EXPRESS",
        items: [{
          name: "Smoke item A",
          qty: 1,
          unitPrice: 10,
          attrs: { originCountry: "CN", manufacturerName: "Smoke Factory LLC", composition: "aluminium, plastics" },
        }],
      }),
    }).then(async (r) => {
      const body = await r.json();
      if (!r.ok) throw new Error(`Create: ${r.status} ${JSON.stringify(body)}`);
      return body;
    });
    target = created;
    if (!created.items?.length) throw new Error("Expected real items on create");
  }

  console.log("Pay", target.number, target.id);
  const paid = await fetch(`${BASE}/api/v1/calculations/${target.id}/pay`, {
    method: "POST",
    headers,
    body: JSON.stringify({ preferredBrokerUserId: null }),
  }).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(`Pay: ${r.status} ${JSON.stringify(body)}`);
    return body;
  });

  // EXPRESS high-conf → DONE; broker tariffs → QUEUED or IN_REVIEW (autoAssignBrokers)
  if (!["DONE", "QUEUED", "IN_REVIEW"].includes(paid.status)) {
    throw new Error(`Unexpected status after pay: ${paid.status}`);
  }
  if (paid.status === "DONE" && !paid.pdfHtml) {
    throw new Error("DONE without pdfHtml");
  }

  console.log(
    "✅ Smoke OK:",
    paid.number,
    "→",
    paid.status,
    paid.status === "IN_REVIEW" ? "(autoAssign)" : ""
  );
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
