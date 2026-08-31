#!/usr/bin/env node
/**
 * Unified smoke: client upload + STANDARD create → AI_READY → pay → QUEUED
 * → broker claim/approve → client DONE + PDF.
 *
 * Requires running app (local or TEST_API_URL) and seeded demo users/balance.
 *
 *   npm run smoke:full
 *   TEST_API_URL=https://ibm-cargo.vercel.app npm run smoke:full
 *
 * Image is attachment-only (not sent to AI/LLM). LLM enrich is optional:
 * logged when aiDraft.llmEnrich is present (compose with LLM_SERVICE_URL).
 */
import "./lib/install-vercel-bypass.mjs";
const BASE = process.env.TEST_API_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const CLIENT_EMAIL = process.env.CLIENT_EMAIL || "client@example.com";
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD || "demo1234";
const BROKER_EMAIL = process.env.BROKER_EMAIL || "broker@example.com";
const BROKER_PASSWORD = process.env.BROKER_PASSWORD || "demo1234";

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

async function jsonFetch(url, { jar, method = "GET", body, formData, timeoutMs = 45000 } = {}) {
  const headers = { Cookie: cookieHeader(jar) };
  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { method, headers, body: payload, signal: ctrl.signal });
  } catch (e) {
    clearTimeout(timer);
    const msg = e?.name === "AbortError" ? `timeout ${timeoutMs}ms` : e?.message || String(e);
    throw new Error(`${method} ${url}: ${msg}`);
  }
  clearTimeout(timer);
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

async function withRetry(label, fn, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e?.message || String(e);
      if (i < attempts && /terminated|fetch failed|ECONNRESET|empty|Login failed|timeout|AbortError|aborted/i.test(msg)) {
        console.log(`   retry ${label} (${i}/${attempts}):`, msg.slice(0, 80));
        await new Promise((r) => setTimeout(r, 800 * i));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function main() {
  console.log("Smoke full path against", BASE);

  // 1–2. Client login + upload
  const clientJar = await login(CLIENT_EMAIL, CLIENT_PASSWORD, "/cabinet");
  console.log("1. Client logged in");

  const fd = new FormData();
  fd.append("file", new File([TINY_PNG], "smoke.png", { type: "image/png" }));
  const uploaded = await withRetry("upload", () =>
    jsonFetch(`${BASE}/api/v1/uploads`, {
      jar: clientJar,
      method: "POST",
      formData: fd,
    })
  );
  if (!uploaded.url) {
    throw new Error(`Unexpected upload url: ${JSON.stringify(uploaded)}`);
  }
  const url = String(uploaded.url);
  const okLocal = url.startsWith("/uploads/ved/");
  const okS3 = url.startsWith("http://") || url.startsWith("https://");
  if (!okLocal && !okS3) {
    throw new Error(`Unexpected upload url: ${JSON.stringify(uploaded)}`);
  }
  console.log("2. Upload OK", uploaded.url);

  // 3. Create STANDARD with mediaUrl + heuristic keywords
  const created = await jsonFetch(`${BASE}/api/v1/calculations`, {
    jar: clientJar,
    method: "POST",
    body: {
      title: "Smoke full laptop",
      description: "Ноутбук для импорта smoke full-path",
      country: "CN",
      shipmentValue: "2500",
      tariffCode: "STANDARD",
      items: [
        {
          name: "Smoke laptop",
          qty: 1,
          unitPrice: 2500,
          mediaUrl: uploaded.url,
          attrs: { originCountry: "CN", manufacturerName: "Smoke Factory LLC", composition: "aluminium, plastics" },
        },
      ],
    },
  });

  // 4. Assert AI_READY + real items
  if (created.status !== "AI_READY") {
    throw new Error(`Expected AI_READY, got ${created.status}`);
  }
  const items = created.items || [];
  if (!items.length) throw new Error("Expected real CalculationItem rows");
  if (items.some((it) => it.id === "synthetic")) {
    throw new Error("Forbidden synthetic item id");
  }
  if (!items[0].hsCodeAi && !created.hsCode) {
    throw new Error("Expected hsCodeAi / hsCode after AI draft");
  }
  if (items[0].mediaUrl !== uploaded.url) {
    throw new Error(`mediaUrl not persisted: ${items[0].mediaUrl}`);
  }
  const aiDraft = created.aiDraft;
  if (aiDraft?.llmEnrich) {
    console.log("   llmEnrich present:", aiDraft.llmEnrich);
  } else {
    console.log("   llmEnrich absent (heuristic only — OK without LLM_SERVICE_URL)");
  }
  console.log("3–4. Created", created.number, created.id, "→ AI_READY", "HS", created.hsCode || items[0].hsCodeAi);

  // 5. Pay → QUEUED (or IN_REVIEW when autoAssignBrokers is on)
  const paid = await jsonFetch(`${BASE}/api/v1/calculations/${created.id}/pay`, {
    jar: clientJar,
    method: "POST",
    body: { preferredBrokerUserId: null },
  });
  if (!["QUEUED", "IN_REVIEW"].includes(paid.status)) {
    throw new Error(`Expected QUEUED|IN_REVIEW after STANDARD pay, got ${paid.status}`);
  }
  console.log(
    "5. Paid →",
    paid.status,
    paid.status === "IN_REVIEW" ? "(autoAssign)" : ""
  );

  // 6. Broker claim + approve
  const brokerJar = await withRetry("broker-login", () =>
    login(BROKER_EMAIL, BROKER_PASSWORD, "/broker")
  );
  console.log("6a. Broker logged in");

  if (paid.status === "QUEUED") {
    const queue = await withRetry("queue", () =>
      jsonFetch(`${BASE}/api/v1/calculations?scope=queue`, {
        jar: brokerJar,
      })
    );
    if (!Array.isArray(queue)) throw new Error(`Queue error: ${JSON.stringify(queue)}`);
    const inQueue = queue.find((c) => c.id === created.id);
    if (!inQueue) throw new Error(`Created calc ${created.id} not in broker queue`);

    const claimed = await withRetry("claim", () =>
      jsonFetch(`${BASE}/api/v1/calculations/${created.id}/claim`, {
        jar: brokerJar,
        method: "POST",
      })
    );
    if (claimed.status !== "IN_REVIEW") {
      throw new Error(`Expected IN_REVIEW after claim, got ${claimed.status}`);
    }
    console.log("6b. Claimed → IN_REVIEW");
  } else {
    const mine = await withRetry("mine", () =>
      jsonFetch(`${BASE}/api/v1/calculations?scope=mine`, { jar: brokerJar })
    );
    const assigned =
      Array.isArray(mine) && mine.find((c) => c.id === created.id);
    if (!assigned) {
      throw new Error(
        `autoAssign IN_REVIEW calc ${created.id} not in broker mine`
      );
    }
    console.log("6b. Already IN_REVIEW (autoAssign) — in mine");
  }
  const full = await withRetry("get-calc", () =>
    jsonFetch(`${BASE}/api/v1/calculations/${created.id}`, {
      jar: brokerJar,
    })
  );
  const workItems = full.items || [];
  if (!workItems.length) throw new Error("No items for approve");
  const hsFinal = workItems[0].hsCodeAi || full.hsCode || "8471 30 000 0";
  const done = await withRetry("approve", async () => {
    const current = await jsonFetch(`${BASE}/api/v1/calculations/${created.id}`, {
      jar: brokerJar,
    });
    if (current.status === "DONE" && current.pdfHtml) {
      return current;
    }
    return jsonFetch(`${BASE}/api/v1/calculations/${created.id}/approve`, {
      jar: brokerJar,
      method: "POST",
      body: {
        hsCodeFinal: hsFinal,
        comment: "smoke full-path approve",
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
  });
  if (done.status !== "DONE") throw new Error(`Expected DONE, got ${done.status}`);
  if (!done.pdfHtml) throw new Error("DONE without pdfHtml");
  console.log("6c. Approved → DONE");

  // 7. Client sees DONE + PDF + hsCodeFinal
  const clientView = await withRetry("client-view", () =>
    jsonFetch(`${BASE}/api/v1/calculations/${created.id}`, {
      jar: clientJar,
    })
  );
  if (clientView.status !== "DONE") {
    throw new Error(`Client view expected DONE, got ${clientView.status}`);
  }
  const clientItems = clientView.items || [];
  if (!clientItems.some((it) => it.hsCodeFinal)) {
    throw new Error("Client items missing hsCodeFinal");
  }
  const pdfText = await withRetry(
    "pdf",
    async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60000);
      try {
        const pdfRes = await fetch(`${BASE}/api/v1/calculations/${created.id}/pdf`, {
          headers: { Cookie: cookieHeader(clientJar) },
          signal: ctrl.signal,
        });
        if (!pdfRes.ok) throw new Error(`PDF endpoint: ${pdfRes.status}`);
        const text = await pdfRes.text();
        if (!text || text.length < 20) throw new Error("PDF body empty");
        return text;
      } finally {
        clearTimeout(timer);
      }
    },
    4
  );

  console.log(
    "✅ Smoke full OK:",
    clientView.number,
    "→ DONE, items",
    clientItems.length,
    "PDF",
    pdfText.length,
    "chars"
  );
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
