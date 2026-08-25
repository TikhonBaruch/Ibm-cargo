#!/usr/bin/env node
/**
 * Online AI-chain probes → JSONL for analysis.
 *
 *   TEST_API_URL=https://taurus-liart.vercel.app npm run probe:ai-chain
 *
 * Writes: tmp/chain-probes-<stamp>.jsonl (+ .md summary)
 */
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.TEST_API_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const EMAIL = process.env.CLIENT_EMAIL || "client@example.com";
const PASS = process.env.CLIENT_PASSWORD || "demo1234";
const POLL_MS = Number(process.env.PROBE_POLL_MS || 2500);
const WAIT_MS = Number(process.env.PROBE_WAIT_MS || 180_000);

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function cookieJar(res, jar) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}
function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login() {
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
      email: EMAIL,
      password: PASS,
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

async function api(jar, path, { method = "GET", body, formData, timeoutMs = 120000 } = {}) {
  const headers = { Cookie: cookieHeader(jar) };
  let payload;
  if (formData) payload = formData;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: payload,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { _raw: text.slice(0, 400) };
  }
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(data).slice(0, 400)}`);
  return data;
}

function pending(calc) {
  return calc?.aiDrainPending === true || calc?.aiDraft?.llmEnrichPending === true;
}

async function waitEnrich(jar, calc) {
  const t0 = Date.now();
  let latest = calc;
  while (Date.now() - t0 < WAIT_MS && pending(latest)) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    latest = await api(jar, `/api/v1/calculations/${calc.id}`, { timeoutMs: 60000 });
  }
  return { calc: latest, waitedMs: Date.now() - t0 };
}

async function uploadTiny(jar) {
  const fd = new FormData();
  fd.append("file", new File([TINY_PNG], "probe.png", { type: "image/png" }));
  return api(jar, "/api/v1/uploads", { method: "POST", formData: fd, timeoutMs: 60000 });
}

const SCENARIOS = [
  {
    id: "laptop-text",
    title: "Probe laptop text",
    description:
      "Apple MacBook Pro 16 дюймов, ноутбук портативный алюминиевый корпус для импорта",
    country: "Китай",
    shipmentValue: "2500",
    items: [{ name: "MacBook Pro 16", description: "portable computer aluminium", qty: 1, unitPrice: 2500 }],
  },
  {
    id: "cotton-tee",
    title: "Probe cotton tee",
    description: "Футболка мужская хлопковая 100% jersey, повседневная одежда",
    country: "Китай",
    shipmentValue: "12",
    items: [{ name: "Cotton t-shirt", description: "100% cotton jersey mens", qty: 10, unitPrice: 12 }],
  },
  {
    id: "laptop-tiny-png",
    title: "Probe laptop + tiny PNG",
    description: "Ноутбук 14 дюймов Intel Core i7 SSD офисный",
    country: "Китай",
    shipmentValue: "900",
    withUpload: true,
    items: [
      {
        name: "Lenovo ThinkPad",
        description: "aluminium lithium battery office laptop",
        qty: 1,
        unitPrice: 900,
      },
    ],
  },
  {
    id: "shoes-text",
    title: "Probe footwear",
    description: "Кроссовки спортивные с верхом из кожи и резиновой подошвой",
    country: "Китай",
    shipmentValue: "45",
    items: [{ name: "Sports sneakers", description: "leather upper rubber sole", qty: 5, unitPrice: 45 }],
  },
];

async function runScenario(jar, scenario) {
  const t0 = Date.now();
  let mediaUrl;
  if (scenario.withUpload) {
    const up = await uploadTiny(jar);
    mediaUrl = up.url;
  }
  const items = scenario.items.map((it) => ({
    name: it.name,
    description: it.description,
    qty: it.qty,
    unitPrice: it.unitPrice,
    attrs: {
      originCountry: "CN",
      manufacturerName: "Probe Factory LLC",
      composition: it.description || it.name,
    },
    ...(mediaUrl ? { mediaUrl } : {}),
  }));
  const created = await api(jar, "/api/v1/calculations", {
    method: "POST",
    body: {
      title: `${scenario.title} ${Date.now()}`,
      description: scenario.description,
      country: scenario.country,
      shipmentValue: scenario.shipmentValue,
      shipmentCurrency: "USD",
      tariffCode: "STANDARD",
      items,
    },
    timeoutMs: 180000,
  });
  const { calc, waitedMs } = await waitEnrich(jar, created);
  let analysis = null;
  try {
    analysis = await api(jar, `/api/v1/calculations/${calc.id}/chain-log`, { timeoutMs: 60000 });
  } catch (e) {
    analysis = {
      synthesized: true,
      error: e instanceof Error ? e.message : String(e),
      calculationId: calc.id,
      number: calc.number,
      status: calc.status,
      hsCode: calc.hsCode,
      confidence: calc.confidence,
      pending: pending(calc),
      chainId: calc.aiDraft?.chainId,
      llmEnrich: calc.aiDraft?.llmEnrich,
      engine: calc.aiDraft?.engine,
      softFails: calc.aiDraft?.llmSoftFails,
      visionTrace: calc.aiDraft?.visionTrace,
      chainRun: calc.aiDraft?.chainRun || null,
      serviceCalls: [],
      timeline: [],
    };
  }
  return {
    scenario: scenario.id,
    elapsedMs: Date.now() - t0,
    waitedMs,
    mediaUrl: mediaUrl || null,
    calc: {
      id: calc.id,
      number: calc.number,
      status: calc.status,
      hsCode: calc.hsCode,
      confidence: calc.confidence,
      pending: pending(calc),
      aiDraft: {
        chainId: calc.aiDraft?.chainId,
        llmEnrich: calc.aiDraft?.llmEnrich,
        llmEnrichPending: calc.aiDraft?.llmEnrichPending,
        engine: calc.aiDraft?.engine,
        confidence: calc.aiDraft?.confidence,
        softFails: calc.aiDraft?.llmSoftFails,
        visionTrace: calc.aiDraft?.visionTrace,
        chainRun: calc.aiDraft?.chainRun || null,
      },
    },
    analysis,
  };
}

async function main() {
  console.log("AI chain probe →", BASE);
  const jar = await login();
  console.log("login OK");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(process.cwd(), "tmp");
  mkdirSync(dir, { recursive: true });
  const jsonlPath = join(dir, `chain-probes-${stamp}.jsonl`);
  const summaryPath = join(dir, `chain-probes-${stamp}.md`);

  const rows = [];
  for (const sc of SCENARIOS) {
    process.stdout.write(`· ${sc.id}… `);
    try {
      const row = await runScenario(jar, sc);
      rows.push(row);
      appendFileSync(jsonlPath, `${JSON.stringify(row)}\n`);
      console.log(
        `${row.calc.number} HS=${row.calc.hsCode || "—"} enrich=${row.calc.aiDraft.llmEnrich || "—"} pending=${row.calc.pending} ${row.elapsedMs}ms`
      );
    } catch (e) {
      const fail = {
        scenario: sc.id,
        error: e instanceof Error ? e.message : String(e),
        at: new Date().toISOString(),
      };
      rows.push(fail);
      appendFileSync(jsonlPath, `${JSON.stringify(fail)}\n`);
      console.log("FAIL", String(fail.error).slice(0, 160));
    }
  }

  const lines = [
    `# AI chain probes ${stamp}`,
    "",
    `Base: ${BASE}`,
    `JSONL: \`${jsonlPath}\``,
    "",
    "| Scenario | Number | HS | Enrich | Pending | ms |",
    "|----------|--------|----|--------|---------|----|",
    ...rows.map((r) => {
      if (r.error) return `| ${r.scenario} | — | — | — | — | ERR |`;
      return `| ${r.scenario} | ${r.calc.number} | ${r.calc.hsCode || "—"} | ${r.calc.aiDraft.llmEnrich || "heuristic"} | ${r.calc.pending} | ${r.elapsedMs} |`;
    }),
    "",
  ];
  writeFileSync(summaryPath, lines.join("\n"));
  console.log("\nWrote", jsonlPath);
  console.log("Summary", summaryPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
