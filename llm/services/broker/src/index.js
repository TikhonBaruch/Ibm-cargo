/**
 * AI Broker consult stub. Envelope: contracts/d-broker.llm.json
 */
import http from "node:http";

const port = Number(process.env.PORT || 4800);
const ENGINE = "broker-stub-v0";

function advise(body = {}) {
  const q = String(body.question || body.message || body.description || "").trim();
  const escalate =
    /риск|досмотр|запрет|эскалац|брокер|не уверен|uncertain|risk/i.test(q) || q.length < 8;
  return {
    engine: ENGINE,
    answer: q
      ? `Stub advice on: ${q.slice(0, 160)}. For HS/duty see classification service; escalate=${escalate}.`
      : "Ask about HS codes, rates, or import risks. Stub AI Broker.",
    escalate,
    topics: ["hs", "duty", "risk"],
    disclaimer: "Stub AI Broker. Not a licensed customs opinion. Escalate to human broker after pay in LBM.",
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
    res.end(JSON.stringify({ ok: true, service: "broker", engine: ENGINE }));
    return;
  }
  try {
    if (req.method === "POST" && url.pathname === "/v1/advise") {
      res.end(JSON.stringify(advise(await readBody(req))));
      return;
    }
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found", hint: "POST /v1/advise" }));
});

server.listen(port, () => console.log(`[broker] ${ENGINE} on :${port}`));
