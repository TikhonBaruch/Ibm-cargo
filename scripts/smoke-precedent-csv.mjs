#!/usr/bin/env node
/**
 * Precedent + CSV import smoke:
 *   1) full chain approve → seeds VerifiedDetermination
 *   2) second create with same description → llmEnrich=precedent-v1
 *   3) CSV preview → MATCHED_PRECEDENT row
 *
 *   TEST_API_URL=http://localhost:3000 node scripts/smoke-precedent-csv.mjs
 */
import "./lib/install-vercel-bypass.mjs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = process.env.TEST_API_URL || "http://localhost:3000";
const CLIENT_EMAIL = process.env.CLIENT_EMAIL || "client@example.com";
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD || "demo1234";

const PRODUCT_TITLE = "Chain smoke ноутбук";
const PRODUCT_DESC =
  "Apple MacBook Pro 16 дюймов, ноутбук портативный для импорта";
const PRODUCT_ITEM_NAME = "MacBook Pro 16";

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
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieHeader(jar) },
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

async function createCalc(jar, label) {
  const res = await fetch(`${BASE}/api/v1/calculations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(jar),
    },
    body: JSON.stringify({
      title: `${PRODUCT_TITLE} ${label}`,
      description: PRODUCT_DESC,
      country: "Китай",
      shipmentValue: "18000 USD",
      tariffCode: "STANDARD",
      items: [{
        name: PRODUCT_ITEM_NAME,
        description: PRODUCT_DESC,
        attrs: { originCountry: "CN", manufacturerName: "Precedent Mfg", composition: "textile / plastics" },
      }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`create failed: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  console.log(`Precedent smoke → ${BASE}`);

  const chainScript = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "smoke-chain-llm.mjs"
  );
  console.log(" 0. Seed precedent via smoke-chain-llm…");
  const chain = spawnSync(process.execPath, [chainScript], {
    env: { ...process.env, TEST_API_URL: BASE },
    encoding: "utf8",
  });
  if (chain.status !== 0) {
    console.error(chain.stdout);
    console.error(chain.stderr);
    throw new Error("smoke-chain-llm failed — cannot seed precedent");
  }
  console.log("    chain OK");

  const jar = await login(CLIENT_EMAIL, CLIENT_PASSWORD);
  console.log(" 1. Client login OK");

  const calc = await createCalc(jar, "precedent-check");
  const enrich = calc.aiDraft?.llmEnrich || calc.llmEnrich;
  console.log(` 2. Second create #${calc.number} llmEnrich=${enrich}`);

  const csv = `Наименование,Описание\n${PRODUCT_ITEM_NAME},${PRODUCT_DESC}`;
  const previewRes = await fetch(`${BASE}/api/v1/imports/products/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(jar),
    },
    body: JSON.stringify({ csv, tariffCode: "STANDARD" }),
  });
  const preview = await previewRes.json();
  if (!previewRes.ok) throw new Error(`preview failed: ${JSON.stringify(preview)}`);
  const row = preview.rows?.[0];
  console.log(
    ` 3. CSV preview rowStatus=${row?.rowStatus} hs=${row?.hsCode || "—"}`
  );
  if (row?.rowStatus !== "MATCHED_PRECEDENT" && row?.rowStatus !== "CLASSIFIED_NEW") {
    throw new Error(`unexpected row status: ${row?.rowStatus}`);
  }
  if (enrich !== "precedent-v1") {
    throw new Error(`expected precedent-v1 on second create, got ${enrich}`);
  }
  if (row.rowStatus !== "MATCHED_PRECEDENT") {
    throw new Error(`expected CSV MATCHED_PRECEDENT, got ${row.rowStatus}`);
  }

  console.log(`\n✅ Precedent smoke OK (enrich=${enrich}, csv=${row.rowStatus})`);
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
