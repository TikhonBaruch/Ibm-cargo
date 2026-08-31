#!/usr/bin/env node
/**
 * S4 smoke: broker claim (or use IN_REVIEW) → client chat → waitingOn BROKER
 * → broker reply → waitingOn CLIENT → GET messages ≥ 2.
 *
 *   npm run smoke:chat
 *   TEST_API_URL=http://localhost:3000 npm run smoke:chat
 */
import "./lib/install-vercel-bypass.mjs";
const BASE = process.env.TEST_API_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
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

async function login(email, password, callbackPath) {
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
      callbackUrl: `${BASE}${callbackPath}`,
    }),
    redirect: "manual",
  });
  cookieJar(loginRes, jar);
  if (![200, 302].includes(loginRes.status)) {
    throw new Error(`Login failed for ${email}: ${loginRes.status}`);
  }
  return jar;
}

async function jsonFetch(url, { jar, method = "GET", body } = {}) {
  const headers = { Cookie: cookieHeader(jar) };
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  console.log("Smoke chat path against", BASE);

  const brokerJar = await login(BROKER_EMAIL, BROKER_PASSWORD, "/broker");
  const clientJar = await login(CLIENT_EMAIL, CLIENT_PASSWORD, "/cabinet");

  // Prefer queue claim so chat thread exists
  const queue = await jsonFetch(`${BASE}/api/v1/calculations?scope=queue`, { jar: brokerJar });
  if (!Array.isArray(queue)) throw new Error(`Queue error: ${JSON.stringify(queue)}`);

  let calcId;
  let number;

  const mine = await jsonFetch(`${BASE}/api/v1/calculations?scope=mine`, { jar: brokerJar });
  const inReview =
    Array.isArray(mine) && mine.find((c) => ["IN_REVIEW", "SLA_RISK"].includes(c.status));

  if (inReview) {
    calcId = inReview.id;
    number = inReview.number;
    console.log("1. Reuse mine", number, calcId);
  } else if (queue.length) {
    const target = queue.find((c) => c.number === "#SEED-MULTI") || queue[0];
    const claimed = await jsonFetch(`${BASE}/api/v1/calculations/${target.id}/claim`, {
      jar: brokerJar,
      method: "POST",
    });
    calcId = claimed.id;
    number = claimed.number;
    console.log("1. Claimed", number, calcId);
  } else {
    // Bootstrap STANDARD → pay → claim
    console.log("1. Queue empty — create STANDARD + pay + claim");
    const created = await jsonFetch(`${BASE}/api/v1/calculations`, {
      jar: clientJar,
      method: "POST",
      body: {
        title: "Smoke chat",
        description: "Ноутбук smoke chat path",
        country: "CN",
        shipmentValue: "1000",
        tariffCode: "STANDARD",
        items: [{
          name: "Chat item",
          qty: 1,
          unitPrice: 1000,
          attrs: { originCountry: "CN", manufacturerName: "Smoke Factory LLC", composition: "aluminium, plastics" },
        }],
      },
    });
    const paid = await jsonFetch(`${BASE}/api/v1/calculations/${created.id}/pay`, {
      jar: clientJar,
      method: "POST",
      body: { preferredBrokerUserId: null },
    });
    if (!["QUEUED", "IN_REVIEW"].includes(paid.status)) {
      throw new Error(`Expected QUEUED|IN_REVIEW, got ${paid.status}`);
    }
    if (paid.status === "QUEUED") {
      const claimed = await jsonFetch(`${BASE}/api/v1/calculations/${paid.id}/claim`, {
        jar: brokerJar,
        method: "POST",
      });
      calcId = claimed.id;
      number = claimed.number;
    } else {
      calcId = paid.id;
      number = paid.number;
      console.log("1. autoAssign → IN_REVIEW", number, calcId);
    }
  }

  const fromClient = await jsonFetch(`${BASE}/api/v1/chat`, {
    jar: clientJar,
    method: "POST",
    body: { calculationId: calcId, body: "smoke chat from client" },
  });
  if (fromClient.waitingOn !== "BROKER") {
    throw new Error(`Expected waitingOn BROKER, got ${fromClient.waitingOn}`);
  }
  console.log("2. Client message → waitingOn BROKER");

  const fromBroker = await jsonFetch(`${BASE}/api/v1/chat`, {
    jar: brokerJar,
    method: "POST",
    body: { calculationId: calcId, body: "smoke chat from broker" },
  });
  if (fromBroker.waitingOn !== "CLIENT") {
    throw new Error(`Expected waitingOn CLIENT, got ${fromBroker.waitingOn}`);
  }
  console.log("3. Broker reply → waitingOn CLIENT");

  const thread = await jsonFetch(`${BASE}/api/v1/chat?calculationId=${encodeURIComponent(calcId)}`, {
    jar: clientJar,
  });
  const list = thread?.messages || (Array.isArray(thread) ? thread : []);
  if (!Array.isArray(list) || list.length < 2) {
    throw new Error(`Expected ≥2 messages, got ${JSON.stringify(thread)}`);
  }

  console.log("✅ Smoke chat OK:", number, "messages", list.length);
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
