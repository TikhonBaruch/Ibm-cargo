/**
 * AI Risk assess stub. Envelope: contracts/d-risk.llm.json
 */
import http from "node:http";

const port = Number(process.env.PORT || 4900);
const ENGINE = "risk-stub-v0";

function assess(body = {}) {
  const text = `${body.description || ""} ${body.hsCode || ""} ${body.country || ""}`.toLowerCase();
  const flags = [];
  if (/хим|chemical|solvent|реактив/.test(text)) flags.push("chemical_control");
  if (/пищев|food|chocolate|чай/.test(text)) flags.push("sanitary_vet");
  if (/бренд|brand|luxury|ролекс|apple/.test(text)) flags.push("ip_brand_risk");
  if (/санкц|sanction|dual.?use/.test(text)) flags.push("sanctions_screen");
  const score = Math.min(0.95, 0.2 + flags.length * 0.18);
  return {
    engine: ENGINE,
    score,
    flags,
    inspectionLikelihood: score >= 0.5 ? "elevated" : "baseline",
    disclaimer: "Stub AI Risk. Not a customs risk engine. Wire real rules later (P3).",
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
    res.end(JSON.stringify({ ok: true, service: "risk", engine: ENGINE }));
    return;
  }
  try {
    if (req.method === "POST" && url.pathname === "/v1/assess") {
      res.end(JSON.stringify(assess(await readBody(req))));
      return;
    }
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found", hint: "POST /v1/assess" }));
});

server.listen(port, () => console.log(`[risk] ${ENGINE} on :${port}`));
