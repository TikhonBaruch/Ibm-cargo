#!/usr/bin/env node
/**
 * C5 gateway auth smoke: login via gateway host, hit /api/v1/me + client surface.
 *
 * Expects docker:full (gateway :8080) with NEXTAUTH_URL pointing at gateway.
 *
 *   TEST_API_URL=http://localhost:8080 npm run smoke:gateway
 *   npm run smoke:gateway   # defaults to :8080
 */
const BASE = process.env.TEST_API_URL || process.env.GATEWAY_URL || "http://localhost:8080";
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
  if (!csrfRes.ok) {
    throw new Error(`csrf failed ${csrfRes.status} — is gateway/web up at ${BASE}?`);
  }
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
  console.log("Smoke gateway auth against", BASE);
  const jar = await login(CLIENT_EMAIL, CLIENT_PASSWORD);
  const headers = { Cookie: cookieHeader(jar) };

  const meRes = await fetch(`${BASE}/api/v1/me`, { headers });
  const me = await meRes.json().catch(() => ({}));
  if (!meRes.ok) {
    throw new Error(`/api/v1/me failed: ${meRes.status} ${JSON.stringify(me)}`);
  }
  console.log("  /api/v1/me OK ·", me.email || me.name || me.id || "user");

  const cabinetRes = await fetch(`${BASE}/cabinet`, {
    headers,
    redirect: "manual",
  });
  if (![200, 302, 307, 308].includes(cabinetRes.status)) {
    throw new Error(`/cabinet unexpected ${cabinetRes.status}`);
  }
  console.log("  /cabinet →", cabinetRes.status);

  // Split surface (optional): gateway /client-app/ when split profile up
  const clientApp = await fetch(`${BASE}/client-app/`, {
    headers,
    redirect: "manual",
  });
  if ([200, 302, 307, 308].includes(clientApp.status)) {
    console.log("  /client-app/ →", clientApp.status, "(split surface reachable)");
  } else if (clientApp.status === 404) {
    console.log("  /client-app/ → 404 (split not mounted — ok for web-only)");
  } else {
    console.log("  /client-app/ →", clientApp.status, "(noted)");
  }

  console.log("Smoke gateway auth OK");
  console.log(
    "C5 note: WEB_SURFACE=slim cutover only after this smoke stays green with NEXTAUTH_URL=",
    BASE
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
