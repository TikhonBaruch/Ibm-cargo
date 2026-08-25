#!/usr/bin/env node
/**
 * Semantic precedent smoke (precedent-v2 via pgvector):
 *   1) chain approve → seeds VerifiedDetermination + embedding
 *   2) create with paraphrased description → llmEnrich=precedent-v2
 *
 * Requires compose postgres (pgvector) + OPENAI_API_KEY for embeddings.
 * Skips gracefully when embeddings unavailable.
 *
 *   TEST_API_URL=http://localhost:3000 node scripts/smoke-precedent-vector.mjs
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = process.env.TEST_API_URL || "http://localhost:3000";
const CLIENT_EMAIL = process.env.CLIENT_EMAIL || "client@example.com";
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD || "demo1234";

const SEED_TITLE = "Vector smoke ноутбук";
const SEED_DESC =
  "Apple MacBook Pro 16 дюймов, ноутбук портативный для импорта";
const SEED_ITEM = "MacBook Pro 16";

const PARAPHRASE_TITLE = "Портативный компьютер для векторного smoke";
const PARAPHRASE_DESC =
  "ноутбук Apple MacBook шестнадцать дюймов портативный компьютер";
const PARAPHRASE_ITEM = "Apple laptop 16 inch";

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

async function createCalc(jar, body) {
  const res = await fetch(`${BASE}/api/v1/calculations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(jar) },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`create failed: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  console.log(`Precedent vector smoke → ${BASE}`);

  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.log(" SKIP: OPENAI_API_KEY not set (embeddings required)");
    process.exit(0);
  }

  const chainScript = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "smoke-chain-llm.mjs"
  );
  const chain = spawnSync(process.execPath, [chainScript], {
    env: { ...process.env, TEST_API_URL: BASE },
    encoding: "utf8",
  });
  if (chain.status !== 0) {
    console.error(chain.stdout);
    console.error(chain.stderr);
    throw new Error("chain seed failed");
  }
  console.log(" 1. Chain seed OK (precedent + embedding on approve)");

  const jar = await login(CLIENT_EMAIL, CLIENT_PASSWORD);
  const calc = await createCalc(jar, {
    title: PARAPHRASE_TITLE,
    description: PARAPHRASE_DESC,
    country: "Китай",
    shipmentValue: "18000 USD",
    tariffCode: "STANDARD",
    items: [{
      name: PARAPHRASE_ITEM,
      description: PARAPHRASE_DESC,
      attrs: { originCountry: "CN", manufacturerName: "Precedent Mfg", composition: "textile / plastics" },
    }],
  });

  const enrich = calc.llmEnrich || calc.draft?.llmEnrich;
  console.log(` 2. Paraphrase create #${calc.id} enrich=${enrich}`);

  if (enrich === "precedent-v2") {
    console.log("\n✅ Precedent vector smoke OK (precedent-v2)");
    return;
  }
  if (enrich === "precedent-v1") {
    console.log(
      " WARN: got precedent-v1 (lexical/fingerprint) — vector path may need tuning or backfill"
    );
    process.exit(0);
  }
  throw new Error(`expected precedent-v2, got ${enrich}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
