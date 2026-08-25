#!/usr/bin/env node
/**
 * Smoke: CSV preview → create calculation from import rows.
 *   TEST_API_URL=http://localhost:3000 node scripts/smoke-csv-import.mjs
 */
const BASE = process.env.TEST_API_URL || "http://localhost:3000";
const CLIENT_EMAIL = process.env.CLIENT_EMAIL || "client@example.com";
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD || "demo1234";

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
      callbackUrl: `${BASE}/cabinet`,
      json: "true",
    }),
    redirect: "manual",
  });
  cookieJar(loginRes, jar);
  return jar;
}

async function main() {
  console.log(`CSV import smoke → ${BASE}`);
  const jar = await login(CLIENT_EMAIL, CLIENT_PASSWORD);
  console.log(" 1. Login OK");

  const csv = `Наименование,Описание,Количество,Цена,Бренд
MacBook Pro 16,Apple ноутбук портативный,1,2500,Apple
Чехол силиконовый,Аксессуар для ноутбука,2,15,Generic`;

  const previewRes = await fetch(`${BASE}/api/v1/imports/products/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(jar) },
    body: JSON.stringify({ csv, tariffCode: "STANDARD", country: "Китай" }),
  });
  const preview = await previewRes.json();
  if (!previewRes.ok) throw new Error(`preview: ${JSON.stringify(preview)}`);
  console.log(
    ` 2. Preview ${preview.rowCount} rows — precedent=${preview.summary.matchedPrecedent} new=${preview.summary.classifiedNew}`
  );
  if (preview.rowCount < 1) throw new Error("no rows");
  if (preview.rowCount > 3) throw new Error("STANDARD max 3 violated");

  const items = preview.rows
    .filter((r) => r.rowStatus !== "PARSE_ERROR")
    .slice(0, 3)
    .map((r) => ({
      name: r.name,
      description: r.description || r.name,
      qty: r.qty || 1,
      unitPrice: r.unitPrice || 0,
      attrs: r.hsCode ? { hsHint: r.hsCode } : undefined,
    }));

  const createRes = await fetch(`${BASE}/api/v1/calculations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(jar) },
    body: JSON.stringify({
      title: `CSV import ${items[0].name}`.slice(0, 120),
      description: items.map((i) => i.name).join("; ").slice(0, 500),
      country: "Китай",
      shipmentValue: "5000",
      tariffCode: "STANDARD",
      items,
    }),
  });
  const calc = await createRes.json();
  if (!createRes.ok) throw new Error(`create: ${JSON.stringify(calc)}`);
  if (calc.status !== "AI_READY" && calc.status !== "AI_PROCESSING") {
    throw new Error(`unexpected status ${calc.status}`);
  }
  console.log(
    ` 3. Created ${calc.number} status=${calc.status} items=${calc.items?.length ?? "?"} llmEnrich=${calc.aiDraft?.llmEnrich || "—"}`
  );
  console.log("\n✅ CSV import smoke OK");
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
