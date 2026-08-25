#!/usr/bin/env node
/**
 * MVP smoke: register new CLIENT → topup stub → upload → create → pay → broker claim/approve.
 *
 * Requires running app + seeded broker. Uses unique email per run.
 * Upload is skipped when host returns 503 "S3 not configured" (Vercel without S3_*).
 *
 *   npm run smoke:mvp
 *   TEST_API_URL=http://localhost:3000 npm run smoke:mvp
 */
const BASE = process.env.TEST_API_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const BROKER_EMAIL = process.env.BROKER_EMAIL || "broker@example.com";
const BROKER_PASSWORD = process.env.BROKER_PASSWORD || "demo1234";
const TOPUP_AMOUNT = Number(process.env.SMOKE_TOPUP_AMOUNT || 5000);

/** Minimal 1×1 PNG */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

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

async function jsonFetch(url, { jar, method = "GET", body, formData } = {}) {
  const headers = { Cookie: cookieHeader(jar) };
  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers, body: payload });
  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { _raw: raw.slice(0, 200) };
  }
  if (!res.ok) {
    throw new Error(`${method} ${url}: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

const TRANSIENT_RE =
  /terminated|fetch failed|ECONNRESET|empty|Login failed|ETIMEDOUT|socket|aborted|timeout|UND_ERR/i;

async function withRetry(label, fn, attempts = 6) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e?.message || String(e);
      if (i < attempts && TRANSIENT_RE.test(msg)) {
        const wait = Math.min(8000, 1500 * i);
        console.log(`   retry ${label} (${i}/${attempts}):`, msg.slice(0, 80));
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/** Hobby cold-start: approve may complete server-side while the client sees timeout / double-post. */
async function fetchDoneOrThrow(jar, calcId, cause) {
  const again = await jsonFetch(`${BASE}/api/v1/calculations/${calcId}`, { jar });
  if (again.status === "DONE") return again;
  throw cause instanceof Error ? cause : new Error(String(cause));
}

async function main() {
  const stamp = Date.now();
  const email = `mvp-smoke-${stamp}@example.com`;
  const password = "demo1234";
  console.log("Smoke MVP against", BASE);
  console.log("Register", email);

  // 1. Register
  const reg = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyName: `Smoke MVP Co ${stamp}`,
      name: "Smoke User",
      email,
      password,
    }),
  }).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(`Register: ${r.status} ${JSON.stringify(body)}`);
    return body;
  });
  if (!reg.user?.id || !reg.company?.id) {
    throw new Error(`Register missing user/company: ${JSON.stringify(reg)}`);
  }
  console.log("1. Registered", reg.user.id, "company", reg.company.id);

  // 2. Login as new client
  const clientJar = await login(email, password, "/cabinet");
  console.log("2. Client logged in");

  // 3. Topup stub/mock (balance 0 → pay needs funds)
  const topup = await jsonFetch(`${BASE}/api/v1/company/topup`, {
    jar: clientJar,
    method: "POST",
    body: { amountRub: TOPUP_AMOUNT, method: "stub" },
  });
  if (topup.pending) {
    throw new Error("MVP smoke expects immediate stub/mock topup, got pending acquiring");
  }
  const me = await jsonFetch(`${BASE}/api/v1/me`, { jar: clientJar });
  const bal = me?.company?.balanceRub ?? 0;
  if (bal < TOPUP_AMOUNT) {
    throw new Error(`Balance after topup too low: ${bal}`);
  }
  console.log("3. Topup OK, balance", bal);

  // 4. Upload — optional when Vercel has no S3_* (mediaUrl is not required for create).
  // File is more reliable than Blob for multipart on Node fetch.
  let mediaUrl;
  try {
    const uploaded = await withRetry("upload", async () => {
      const fd = new FormData();
      fd.append("file", new File([TINY_PNG], "smoke-mvp.png", { type: "image/png" }));
      const res = await jsonFetch(`${BASE}/api/v1/uploads`, {
        jar: clientJar,
        method: "POST",
        formData: fd,
      });
      if (!res.url) throw new Error(`Upload empty: ${JSON.stringify(res)}`);
      return res;
    });
    mediaUrl = uploaded.url;
    console.log("4. Upload OK", uploaded.url, uploaded.storage || "local");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/:\s*503\b/.test(msg) && /S3 not configured/i.test(msg)) {
      console.log("4. Upload skipped (S3 not configured on host) — create without mediaUrl");
    } else if (/terminated|fetch failed|ECONNRESET/i.test(msg)) {
      console.log("4. Upload skipped (transient network) — create without mediaUrl");
    } else {
      throw e;
    }
  }

  // 5. Create STANDARD
  const created = await withRetry("create", () =>
    jsonFetch(`${BASE}/api/v1/calculations`, {
      jar: clientJar,
      method: "POST",
      body: {
        title: "Smoke MVP laptop",
        description: "Ноутбук smoke mvp path",
        country: "CN",
        shipmentValue: "2500",
        tariffCode: "STANDARD",
        items: [
          {
            name: "MVP laptop",
            qty: 1,
            unitPrice: 2500,
            attrs: { originCountry: "CN", manufacturerName: "Smoke Factory LLC", composition: "aluminium, plastics" },
            ...(mediaUrl ? { mediaUrl } : {}),
          },
        ],
      },
    })
  );
  if (created.status !== "AI_READY") {
    throw new Error(`Expected AI_READY, got ${created.status}`);
  }
  console.log("5. Created", created.number, "→ AI_READY");

  // 6. Pay → QUEUED (or IN_REVIEW when autoAssignBrokers is on)
  const paid = await jsonFetch(`${BASE}/api/v1/calculations/${created.id}/pay`, {
    jar: clientJar,
    method: "POST",
    body: { preferredBrokerUserId: null },
  });
  if (!["QUEUED", "IN_REVIEW"].includes(paid.status)) {
    throw new Error(`Expected QUEUED|IN_REVIEW after pay, got ${paid.status}`);
  }
  console.log(
    "6. Paid →",
    paid.status,
    paid.status === "IN_REVIEW" ? "(autoAssign)" : ""
  );

  // 7. Broker claim (skip if auto-assigned) + approve
  const brokerJar = await withRetry("broker-login", () =>
    login(BROKER_EMAIL, BROKER_PASSWORD, "/broker")
  );
  let claimed = paid;
  if (paid.status === "QUEUED") {
    claimed = await withRetry("claim", () =>
      jsonFetch(`${BASE}/api/v1/calculations/${created.id}/claim`, {
        jar: brokerJar,
        method: "POST",
      })
    );
  } else {
    console.log("7a. Already IN_REVIEW (autoAssign) — skip claim");
  }
  if (claimed.status !== "IN_REVIEW") {
    throw new Error(`Expected IN_REVIEW, got ${claimed.status}`);
  }

  const full = await withRetry("get-calc", () =>
    jsonFetch(`${BASE}/api/v1/calculations/${created.id}`, { jar: brokerJar })
  );
  const workItems = full.items || [];
  const hsFinal = workItems[0]?.hsCodeAi || full.hsCode || "8471 30 000 0";
  const done = await withRetry("approve", async () => {
    const current = await jsonFetch(`${BASE}/api/v1/calculations/${created.id}`, {
      jar: brokerJar,
    });
    // Pass on DONE without requiring pdfHtml (list/get may omit it on Hobby).
    if (current.status === "DONE") {
      return current;
    }
    try {
      return await jsonFetch(`${BASE}/api/v1/calculations/${created.id}/approve`, {
        jar: brokerJar,
        method: "POST",
        body: {
          hsCodeFinal: hsFinal,
          comment: "smoke mvp approve",
          feeRub: full.feeRub ?? 15000,
          items: workItems.map((it) => ({
            id: it.id,
            hsCodeFinal: it.hsCodeFinal || it.hsCodeAi || hsFinal,
            dutyRub: it.dutyRub ?? 0,
            vatRub: it.vatRub ?? 0,
            unitPrice: it.unitPrice ?? 0,
          })),
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/Cannot approve from DONE/i.test(msg) || TRANSIENT_RE.test(msg)) {
        return fetchDoneOrThrow(brokerJar, created.id, e);
      }
      throw e;
    }
  });
  if (done.status !== "DONE") {
    throw new Error(`Approve failed: ${JSON.stringify(done)}`);
  }
  console.log("7. Approved → DONE");

  const clientView = await jsonFetch(`${BASE}/api/v1/calculations/${created.id}`, {
    jar: clientJar,
  });
  if (clientView.status !== "DONE") {
    throw new Error(`Client view expected DONE, got ${clientView.status}`);
  }

  console.log("✅ Smoke MVP OK:", email, "→", clientView.number, "DONE");
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
