import http from "node:http";
import { buildHeuristicDraft } from "./draft-engine.js";
import { enrichWithLlm } from "./enrich-llm.js";

const port = Number(process.env.PORT || 4100);
const llmUrl = (process.env.LLM_SERVICE_URL || "").replace(/\/$/, "");

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
    res.end(
      JSON.stringify({
        ok: true,
        service: "ai",
        engine: "heuristic-v1",
        llm: llmUrl || null,
      })
    );
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/draft") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }
    if (!body.description && !body.title) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "description or title required" }));
      return;
    }
    const draft = buildHeuristicDraft(body);
    res.end(JSON.stringify(await enrichWithLlm(body, draft, { llmUrl })));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found", hint: "POST /v1/draft" }));
});

server.listen(port, () => {
  console.log(`[ai] heuristic-v1 on :${port}${llmUrl ? ` · llm=${llmUrl}` : ""}`);
});
