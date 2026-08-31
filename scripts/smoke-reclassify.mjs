#!/usr/bin/env node
/**
 * Smoke: broker reclassify with feedback (NVIDIA / current LLM).
 *   TEST_API_URL=http://localhost:3000 node scripts/smoke-reclassify.mjs
 */
import "./lib/install-vercel-bypass.mjs";
const BASE = process.env.TEST_API_URL || "http://localhost:3000";
const CLIENT_EMAIL = process.env.CLIENT_EMAIL || "client@example.com";
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD || "demo1234";
const BROKER_EMAIL = process.env.BROKER_EMAIL || "broker@example.com";
const BROKER_PASSWORD = process.env.BROKER_PASSWORD || "demo1234";

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
async function login(email, password, callbackPath) {
  const jar = new Map();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  cookieJar(csrfRes, jar);
  const { csrfToken } = await csrfRes.json();
  await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(jar),
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: `${BASE}${callbackPath}`,
      json: "true",
    }),
    redirect: "manual",
  }).then((r) => cookieJar(r, jar));
  return jar;
}
async function jsonFetch(url, { jar, method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Cookie: cookieHeader(jar),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  console.log(`Reclassify smoke → ${BASE}`);
  const clientJar = await login(CLIENT_EMAIL, CLIENT_PASSWORD, "/cabinet");
  console.log(" 1. Client login OK");
  const created = await jsonFetch(`${BASE}/api/v1/calculations`, {
    jar: clientJar,
    method: "POST",
    body: {
      title: "Reclassify smoke ноутбук",
      description: "Apple MacBook Pro 16 дюймов для теста переклассификации",
      country: "Китай",
      shipmentValue: "18000",
      tariffCode: "STANDARD",
      items: [
        {
          name: "MacBook Pro 16",
          description: "Apple MacBook Pro 16 дюймов для теста переклассификации",
          attrs: { originCountry: "CN", manufacturerName: "Apple Inc.", composition: "aluminium, plastics, Li-ion" },
        },
      ],
    },
  });
  console.log(` 2. Create ${created.number} hs=${created.hsCode} enrich=${created.aiDraft?.llmEnrich}`);
  const paid = await jsonFetch(`${BASE}/api/v1/calculations/${created.id}/pay`, {
    jar: clientJar,
    method: "POST",
    body: {},
  });
  console.log(` 3. Paid → ${paid.status}`);

  const brokerJar = await login(BROKER_EMAIL, BROKER_PASSWORD, "/broker");
  console.log(" 4. Broker login OK");
  if (paid.status === "QUEUED") {
    await jsonFetch(`${BASE}/api/v1/calculations/${created.id}/claim`, {
      jar: brokerJar,
      method: "POST",
    });
  }
  const before = await jsonFetch(`${BASE}/api/v1/calculations/${created.id}`, {
    jar: brokerJar,
  });
  const hsBefore = before.hsCode;
  const recl = await jsonFetch(`${BASE}/api/v1/calculations/${created.id}/reclassify`, {
    jar: brokerJar,
    method: "POST",
    body: {
      brokerFeedback: "Это аксессуар/чехол, не вычислительная машина — пересмотри код",
    },
  });
  console.log(
    ` 5. Reclassify hs ${hsBefore} → ${recl.hsCode} enrich=${recl.aiDraft?.llmEnrich || "—"}`
  );
  if (!recl.hsCode) throw new Error("empty hs after reclassify");
  if (recl.status !== "IN_REVIEW" && recl.status !== "SLA_RISK") {
    throw new Error(`status should stay reviewable, got ${recl.status}`);
  }
  console.log("\n✅ Reclassify smoke OK");
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
