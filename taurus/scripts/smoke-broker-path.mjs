#!/usr/bin/env node
/**
 * Broker smoke: login → queue → claim → PATCH items (mapping correction) → approve → PDF.
 * Requires a running app (local or TEST_API_URL) and seeded DB (demo #SEED-MULTI in queue).
 *
 *   npm run smoke:broker
 *   TEST_API_URL=https://taurus-liart.vercel.app npm run smoke:broker
 *
 * Covers real broker check/correct path (WorkMapping inputs). There is no
 * "send for revision with dropdowns" API — only PATCH items + approve (and chat).
 */
const BASE = process.env.TEST_API_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const EMAIL = process.env.BROKER_EMAIL || "broker@example.com";
const PASSWORD = process.env.BROKER_PASSWORD || "demo1234";

/** Deliberate broker correction vs AI draft (smoke mapping). */
const CORRECTED_HS = "8471 50 000 0";
const CORRECTED_DUTY = 1111;
const CORRECTED_VAT = 2222;
const CORRECTED_FEE = 13337;

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

async function main() {
  const jar = new Map();
  console.log("Smoke broker path against", BASE);

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
      callbackUrl: `${BASE}/broker`,
    }),
    redirect: "manual",
  });
  cookieJar(loginRes, jar);
  if (![200, 302].includes(loginRes.status)) {
    throw new Error(`Login failed: ${loginRes.status}`);
  }

  const headers = {
    Cookie: cookieHeader(jar),
    "Content-Type": "application/json",
  };

  const queue = await fetch(`${BASE}/api/v1/calculations?scope=queue`, { headers }).then((r) =>
    r.json()
  );
  if (!Array.isArray(queue)) throw new Error(`Queue error: ${JSON.stringify(queue)}`);
  const target = queue.find((c) => c.number === "#SEED-MULTI") || queue[0];
  if (!target) throw new Error("Queue empty — run prisma db seed first");

  console.log("1. Claim", target.number, target.id);
  const claimed = await fetch(`${BASE}/api/v1/calculations/${target.id}/claim`, {
    method: "POST",
    headers,
  }).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(`Claim: ${r.status} ${JSON.stringify(body)}`);
    return body;
  });
  if (!["IN_REVIEW", "SLA_RISK"].includes(claimed.status)) {
    throw new Error(`Expected IN_REVIEW after claim, got ${claimed.status}`);
  }

  const full = await fetch(`${BASE}/api/v1/calculations/${claimed.id}`, { headers }).then((r) =>
    r.json()
  );
  const items = full.items || [];
  if (items.length < 1) throw new Error("Expected real CalculationItem rows (no synthetic)");
  if (items.some((it) => it.id === "synthetic")) {
    throw new Error("Forbidden synthetic item id");
  }
  if (!items.some((it) => it.hsCodeAi) && !full.hsCode) {
    throw new Error("Expected hsCodeAi / hsCode from AI draft");
  }
  console.log("2. AI fields OK", "hsCodeAi=", items[0].hsCodeAi || full.hsCode);

  const patchBody = {
    hsCodeFinal: CORRECTED_HS,
    feeRub: CORRECTED_FEE,
    items: items.map((it, idx) => ({
      id: it.id,
      hsCodeFinal: idx === 0 ? CORRECTED_HS : it.hsCodeFinal || it.hsCodeAi || CORRECTED_HS,
      dutyRub: idx === 0 ? CORRECTED_DUTY : it.dutyRub ?? 0,
      vatRub: idx === 0 ? CORRECTED_VAT : it.vatRub ?? 0,
      unitPrice: it.unitPrice ?? 0,
    })),
  };

  console.log("3. PATCH items (mapping correction)");
  const patched = await fetch(`${BASE}/api/v1/calculations/${claimed.id}/items`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(patchBody),
  }).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(`PATCH items: ${r.status} ${JSON.stringify(body)}`);
    return body;
  });

  if (!["IN_REVIEW", "SLA_RISK"].includes(patched.status)) {
    throw new Error(`Expected still IN_REVIEW after PATCH, got ${patched.status}`);
  }
  const patchedItems = patched.items || [];
  const first = patchedItems.find((it) => it.id === items[0].id) || patchedItems[0];
  if (!first) throw new Error("No items after PATCH");
  if (first.hsCodeFinal !== CORRECTED_HS) {
    throw new Error(`hsCodeFinal not saved: ${first.hsCodeFinal}`);
  }
  if (Number(first.dutyRub) !== CORRECTED_DUTY) {
    throw new Error(`dutyRub not saved: ${first.dutyRub}`);
  }
  if (Number(first.vatRub) !== CORRECTED_VAT) {
    throw new Error(`vatRub not saved: ${first.vatRub}`);
  }
  if (Number(patched.feeRub) !== CORRECTED_FEE) {
    throw new Error(`feeRub not saved: ${patched.feeRub}`);
  }
  if (first.confirmedByBrokerAt == null) {
    console.log("   (confirmedByBrokerAt not in response — OK if omitted)");
  } else {
    console.log("   confirmedByBrokerAt", first.confirmedByBrokerAt);
  }
  console.log("3. PATCH OK →", patched.status, "HS", first.hsCodeFinal);

  const approveBody = {
    hsCodeFinal: CORRECTED_HS,
    comment: "smoke broker mapping approve",
    feeRub: CORRECTED_FEE,
    items: patchBody.items,
  };

  console.log("4. Approve with corrected items");
  const done = await fetch(`${BASE}/api/v1/calculations/${claimed.id}/approve`, {
    method: "POST",
    headers,
    body: JSON.stringify(approveBody),
  }).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(`Approve: ${r.status} ${JSON.stringify(body)}`);
    return body;
  });

  if (done.status !== "DONE") throw new Error(`Expected DONE, got ${done.status}`);
  if (!done.pdfHtml) throw new Error("DONE without pdfHtml");
  const pdfOk =
    done.pdfHtml.includes(CORRECTED_HS) ||
    done.pdfHtml.includes(CORRECTED_HS.replace(/\s+/g, "")) ||
    done.pdfHtml.includes("Сопоставление");
  if (!pdfOk) throw new Error("PDF missing corrected HS / mapping table");

  const doneItem = (done.items || []).find((it) => it.id === items[0].id);
  if (doneItem && doneItem.hsCodeFinal !== CORRECTED_HS) {
    throw new Error(`DONE item hsCodeFinal expected ${CORRECTED_HS}, got ${doneItem.hsCodeFinal}`);
  }

  console.log("✅ Smoke OK:", done.number, "→ DONE (mapping corrected), PDF", done.pdfHtml.length, "chars");
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
