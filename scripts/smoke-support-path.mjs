#!/usr/bin/env node
/**
 * Support chat smoke: client ticket → admin reply → client sees messages.
 *
 *   npm run smoke:support
 *   TEST_API_URL=http://localhost:3000 npm run smoke:support
 */
const BASE = process.env.TEST_API_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const CLIENT_EMAIL = process.env.CLIENT_EMAIL || "client@example.com";
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD || "demo1234";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "demo1234";

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
  console.log("Smoke support path against", BASE);
  const stamp = Date.now();
  const clientJar = await login(CLIENT_EMAIL, CLIENT_PASSWORD, "/cabinet");
  const created = await jsonFetch(`${BASE}/api/v1/chat`, {
    jar: clientJar,
    method: "POST",
    body: {
      kind: "SUPPORT",
      subject: `Smoke support ${stamp}`,
      body: "smoke support from client",
    },
  });
  const threadId = created.thread?.id || created.threadId;
  if (!threadId) throw new Error("No support thread id");
  console.log("1. Client ticket", threadId);

  const adminJar = await login(ADMIN_EMAIL, ADMIN_PASSWORD, "/admin");
  const inbox = await jsonFetch(`${BASE}/api/v1/chat?scope=support&box=open`, { jar: adminJar });
  if (!Array.isArray(inbox)) throw new Error("Admin inbox not array");
  const row = inbox.find((t) => t.id === threadId) || inbox[0];
  if (!row?.id) throw new Error("Admin inbox empty");
  console.log("2. Admin inbox OK", row.id);

  await jsonFetch(`${BASE}/api/v1/chat`, {
    jar: adminJar,
    method: "POST",
    body: {
      kind: "SUPPORT_REPLY",
      threadId: row.id,
      body: "smoke reply from admin",
    },
  });
  console.log("3. Admin reply OK");

  const detail = await jsonFetch(`${BASE}/api/v1/chat?threadId=${encodeURIComponent(row.id)}`, {
    jar: clientJar,
  });
  const messages = detail?.messages || [];
  if (!Array.isArray(messages) || messages.length < 2) {
    throw new Error(`Expected ≥2 messages, got ${JSON.stringify(detail)}`);
  }
  console.log("✅ Smoke support OK:", row.id, "messages", messages.length);
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
