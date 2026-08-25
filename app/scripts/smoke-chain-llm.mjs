#!/usr/bin/env node
/**
 * Chain smoke: upload → create (LLM enrich) → pay → broker approve → client PDF.
 *   TEST_API_URL=http://localhost:3000 node scripts/smoke-chain-llm.mjs
 */
const BASE = process.env.TEST_API_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const CLIENT_EMAIL = process.env.CLIENT_EMAIL || "client@example.com";
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD || "demo1234";
const BROKER_EMAIL = process.env.BROKER_EMAIL || "broker@example.com";
const BROKER_PASSWORD = process.env.BROKER_PASSWORD || "demo1234";
const OUT = process.env.CHAIN_PDF_OUT || "/tmp/lbm-chain-result.html";

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
    throw new Error(`Login ${email}: ${loginRes.status}`);
  }
  return jar;
}
async function jsonFetch(url, { jar, method = "GET", body, formData, timeoutMs = 90000 } = {}) {
  const headers = { Cookie: cookieHeader(jar) };
  let payload;
  if (formData) payload = formData;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { method, headers, body: payload, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { _raw: raw.slice(0, 300) };
  }
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

const log = (step, msg, detail = "") =>
  console.log(`${String(step).padStart(2)}. ${msg}${detail ? ` — ${detail}` : ""}`);

async function main() {
  console.log("Chain smoke →", BASE);
  const clientJar = await login(CLIENT_EMAIL, CLIENT_PASSWORD, "/cabinet");
  log(1, "Клиент: вход OK");

  const fd = new FormData();
  fd.append("file", new File([TINY_PNG], "chain-smoke.png", { type: "image/png" }));
  const uploaded = await jsonFetch(`${BASE}/api/v1/uploads`, {
    jar: clientJar,
    method: "POST",
    formData: fd,
  });
  const url = String(uploaded.url || "");
  const storage = String(uploaded.storage || "");
  const okLocal = url.startsWith("/uploads/ved/") && (storage === "local" || !storage);
  const okS3 =
    (url.startsWith("http://") || url.startsWith("https://")) &&
    (storage === "s3" || storage === "local" || !storage);
  if (!okLocal && !okS3) {
    throw new Error(`Upload unexpected: ${JSON.stringify(uploaded)}`);
  }
  log(2, "Клиент: upload OK", `${storage || "?"} ${url}`);

  const fileGetUrl = url.startsWith("http") ? url : `${BASE}${url}`;
  const fileGet = await fetch(fileGetUrl, {
    headers: url.startsWith("http") ? undefined : { Cookie: cookieHeader(clientJar) },
  });
  log(3, "Клиент: GET файла", `HTTP ${fileGet.status} (${fileGet.headers.get("content-type") || "?"})`);

  let created = await jsonFetch(`${BASE}/api/v1/calculations`, {
    jar: clientJar,
    method: "POST",
    body: {
      title: "Chain smoke ноутбук",
      description: "Apple MacBook Pro 16 дюймов, ноутбук портативный для импорта",
      country: "Китай",
      shipmentValue: "2500",
      tariffCode: "STANDARD",
      items: [
        {
          name: "MacBook Pro 16",
          qty: 1,
          unitPrice: 2500,
          mediaUrl: uploaded.url,
          attrs: { originCountry: "CN", manufacturerName: "Apple Inc.", composition: "aluminium, plastics, Li-ion" },
        },
      ],
    },
    timeoutMs: 120000,
  });
  if (created.status !== "AI_READY") throw new Error(`Expected AI_READY, got ${created.status}`);
  // Vercel: create returns heuristic + llmEnrichPending; poll like cabinet (≤2 min).
  const pending = (c) =>
    c?.aiDrainPending === true || c?.aiDraft?.llmEnrichPending === true;
  if (pending(created)) {
    log(" ", "AI_DRAIN pending — poll до llmEnrich…");
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline && pending(created)) {
      await new Promise((r) => setTimeout(r, 2500));
      created = await jsonFetch(`${BASE}/api/v1/calculations/${created.id}`, {
        jar: clientJar,
        timeoutMs: 60000,
      });
    }
  }
  const items = created.items || [];
  if (!items.length || items.some((it) => it.id === "synthetic")) {
    throw new Error("Expected real CalculationItem rows");
  }
  if (items[0].mediaUrl !== uploaded.url) {
    throw new Error(`mediaUrl mismatch: ${items[0].mediaUrl}`);
  }
  const hsAi = items[0].hsCodeAi || created.hsCode;
  const enrich = created.aiDraft?.llmEnrich;
  log(
    4,
    "Клиент: create → AI_READY",
    `${created.number} HS=${hsAi} llmEnrich=${enrich || (pending(created) ? "still-pending" : "heuristic-only")}`
  );
  if (created.aiDraft?.candidates?.length) {
    log(" ", `кандидатов корпуса: ${created.aiDraft.candidates.length}`);
  }

  const paid = await jsonFetch(`${BASE}/api/v1/calculations/${created.id}/pay`, {
    jar: clientJar,
    method: "POST",
    body: { preferredBrokerUserId: null },
  });
  if (!["QUEUED", "IN_REVIEW"].includes(paid.status)) {
    throw new Error(`Pay → ${paid.status}`);
  }
  log(5, "Клиент: оплата", paid.status);

  const brokerJar = await login(BROKER_EMAIL, BROKER_PASSWORD, "/broker");
  log(6, "Брокер: вход OK");

  if (paid.status === "QUEUED") {
    await jsonFetch(`${BASE}/api/v1/calculations/${created.id}/claim`, {
      jar: brokerJar,
      method: "POST",
    });
    log(7, "Брокер: claim → IN_REVIEW");
  } else {
    log(7, "Брокер: уже IN_REVIEW (autoAssign)");
  }

  const full = await jsonFetch(`${BASE}/api/v1/calculations/${created.id}`, { jar: brokerJar });
  const workItems = full.items || [];
  const hsFinal = workItems[0]?.hsCodeAi || full.hsCode || hsAi;
  log(8, "Брокер: видит черновик", `hsCodeAi=${workItems[0]?.hsCodeAi} media=${workItems[0]?.mediaUrl ? "yes" : "no"}`);

  const done = await jsonFetch(`${BASE}/api/v1/calculations/${created.id}/approve`, {
    jar: brokerJar,
    method: "POST",
    body: {
      hsCodeFinal: hsFinal,
      comment: "Chain smoke: подтверждаю",
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
  if (done.status !== "DONE" || !done.pdfHtml) throw new Error(`Approve failed: ${done.status}`);
  log(9, "Брокер: approve → DONE", `hsFinal=${hsFinal}`);

  const clientView = await jsonFetch(`${BASE}/api/v1/calculations/${created.id}`, { jar: clientJar });
  if (clientView.status !== "DONE") throw new Error(`Client view ${clientView.status}`);
  log(10, "Клиент: статус DONE", clientView.number);

  const pdfRes = await fetch(`${BASE}/api/v1/calculations/${created.id}/pdf`, {
    headers: { Cookie: cookieHeader(clientJar) },
  });
  if (!pdfRes.ok) throw new Error(`PDF ${pdfRes.status}`);
  const pdfText = await pdfRes.text();
  if (pdfText.length < 50) throw new Error("PDF empty");
  const fs = await import("node:fs");
  fs.writeFileSync(OUT, pdfText);
  const hsOk =
    pdfText.includes(hsFinal) ||
    pdfText.replace(/\s/g, "").includes(String(hsFinal).replace(/\s/g, ""));
  log(11, "Клиент: скачал результат", `${OUT} (${pdfText.length} bytes, hsInDoc=${hsOk})`);

  console.log("\n✅ Chain OK:", clientView.number, created.id);
}

main().catch((e) => {
  console.error("\n❌ Chain failed:", e.message || e);
  process.exit(1);
});
