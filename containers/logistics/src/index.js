/**
 * Logistics / 3PL — quotes + tracking (d-ship.logistics.json).
 * Providers:
 *   stub (default) — formula mirrors domain.buildStubShippingQuotes
 *   demo — CDEK-shaped labels/pricing (deterministic “real” provider without API key)
 * Env: LOGISTICS_PROVIDER=stub|demo
 */
import http from "node:http";

const port = Number(process.env.PORT || 4600);
const provider = (process.env.LOGISTICS_PROVIDER || "demo").toLowerCase() === "stub" ? "stub" : "demo";

function stubQuotes(opts = {}) {
  const origin = opts.origin || "Шанхай";
  const destination = opts.destination || "Москва";
  const base = 45000 + (origin.length + destination.length) * 120;
  return [
    {
      id: "q_lcl",
      mode: "LCL",
      etaDays: 28,
      priceRub: Math.round(base * 0.85),
      carrierLabel: "SilkWay LCL",
    },
    {
      id: "q_fcl",
      mode: "FCL",
      etaDays: 22,
      priceRub: Math.round(base * 1.35),
      carrierLabel: "EastImport FCL 40'",
    },
    {
      id: "q_air",
      mode: "AIR",
      etaDays: 5,
      priceRub: Math.round(base * 2.1),
      carrierLabel: "AeroCargo Express",
    },
  ];
}

/** Demo 3PL: CDEK-shaped product names + slightly different formula. */
function demoQuotes(opts = {}) {
  const origin = opts.origin || "Шанхай";
  const destination = opts.destination || "Москва";
  const hash = [...origin, ...destination].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const base = 42000 + hash * 17;
  return [
    {
      id: "q_lcl",
      mode: "LCL",
      etaDays: 26,
      priceRub: Math.round(base * 0.9),
      carrierLabel: "CDEK Collect · LCL",
    },
    {
      id: "q_fcl",
      mode: "FCL",
      etaDays: 20,
      priceRub: Math.round(base * 1.4),
      carrierLabel: "CDEK Full · FCL 40'",
    },
    {
      id: "q_air",
      mode: "AIR",
      etaDays: 4,
      priceRub: Math.round(base * 2.25),
      carrierLabel: "CDEK Air Express",
    },
  ];
}

function buildQuotes(opts = {}) {
  const quotes = provider === "demo" ? demoQuotes(opts) : stubQuotes(opts);
  const pref = opts.mode?.toUpperCase() || opts.preferredMode?.toUpperCase();
  return quotes.map((q) => ({
    ...q,
    selected: pref ? q.mode === pref : q.mode === "LCL",
    provider: provider === "demo" ? "demo-3pl" : "stub-3pl",
  }));
}

function buildTracking(code) {
  const trackingCode = code || `LC-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = Date.now();
  const events = [
    { at: new Date(now - 5 * 86400_000).toISOString(), status: "QUOTED", label: "Котировка принята" },
    { at: new Date(now - 2 * 86400_000).toISOString(), status: "IN_TRANSIT", label: "Выпущено со склада" },
    { at: new Date(now + 10 * 86400_000).toISOString(), status: "DELIVERED", label: "Плановая доставка" },
  ];
  const n = trackingCode.split("").reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const phase = n % 3;
  const status = ["QUOTED", "IN_TRANSIT", "DELIVERED"][phase];
  return {
    trackingCode,
    status,
    eta: events[2].at,
    events: events.slice(0, phase + 1),
    provider: provider === "demo" ? "demo-3pl" : "stub-3pl",
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);

  if (url.pathname === "/health") {
    res.end(JSON.stringify({ ok: true, service: "logistics", provider: provider === "demo" ? "demo-3pl" : "stub-3pl" }));
    return;
  }

  try {
    if (req.method === "POST" && url.pathname === "/v1/quotes") {
      const body = await readBody(req);
      if (!body.origin || !body.destination) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "origin and destination required" }));
        return;
      }
      res.end(
        JSON.stringify({
          quotes: buildQuotes(body),
          provider: provider === "demo" ? "demo-3pl" : "stub-3pl",
        })
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/tracking") {
      const body = await readBody(req);
      const code = body.trackingCode || body.requestId || body.code;
      res.end(JSON.stringify(buildTracking(code)));
      return;
    }

    const trackMatch = url.pathname.match(/^\/v1\/tracking\/([^/]+)$/);
    if (req.method === "GET" && trackMatch) {
      res.end(JSON.stringify(buildTracking(decodeURIComponent(trackMatch[1]))));
      return;
    }
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found", hint: "POST /v1/quotes | POST/GET /v1/tracking" }));
});

server.listen(port, () => console.log(`[logistics] provider=${provider} on :${port}`));
