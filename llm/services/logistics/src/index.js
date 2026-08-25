/**
 * AI Logistics route stub. Envelope: contracts/d-logistics.llm.json
 * Port 4601 — distinct from LBM containers/logistics :4600 (3PL quotes).
 */
import http from "node:http";

const port = Number(process.env.PORT || 4601);
const ENGINE = "logistics-ai-stub-v0";

function route(body = {}) {
  const cargo = String(body.cargoType || body.description || "general").slice(0, 80);
  const prefer = String(body.prefer || "balanced");
  const options = [
    {
      id: "rail-demo",
      mode: "rail",
      carrier: "Demo Rail CN-RU",
      daysMin: 18,
      daysMax: 25,
      priceRub: 98000,
      score: prefer === "price" ? 0.92 : 0.75,
    },
    {
      id: "air-demo",
      mode: "air",
      carrier: "Demo Air Express",
      daysMin: 3,
      daysMax: 6,
      priceRub: 210000,
      score: prefer === "speed" ? 0.95 : 0.55,
    },
    {
      id: "sea-demo",
      mode: "sea",
      carrier: "Demo Sea FCL",
      daysMin: 28,
      daysMax: 40,
      priceRub: 72000,
      score: prefer === "price" ? 0.88 : 0.6,
    },
  ].sort((a, b) => b.score - a.score);
  return {
    engine: ENGINE,
    cargoType: cargo,
    prefer,
    options,
    disclaimer: "Stub AI Logistics. Not a 3PL quote. LBM shipping uses containers/logistics separately.",
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
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/health") {
    res.end(JSON.stringify({ ok: true, service: "logistics", engine: ENGINE }));
    return;
  }
  try {
    if (req.method === "POST" && url.pathname === "/v1/route") {
      res.end(JSON.stringify(route(await readBody(req))));
      return;
    }
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found", hint: "POST /v1/route" }));
});

server.listen(port, () => console.log(`[logistics] ${ENGINE} on :${port}`));
