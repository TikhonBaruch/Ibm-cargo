/**
 * AI Documents validate stub. Envelope: contracts/d-documents.llm.json
 */
import http from "node:http";

const port = Number(process.env.PORT || 4750);
const ENGINE = "documents-stub-v0";

const REQUIRED = ["invoice", "packing_list", "contract"];

function validate(body = {}) {
  const docs = Array.isArray(body.documents)
    ? body.documents.map((d) => String(d).toLowerCase().replace(/\s+/g, "_"))
    : [];
  const errors = [];
  for (const need of REQUIRED) {
    const present = docs.some((d) => d.includes(need) || d.includes(need.replace("_", "")));
    if (!present) {
      errors.push({ code: "missing_doc", document: need, message: `Missing ${need}` });
    }
  }
  if (body.hsCode && !/\d{4}/.test(String(body.hsCode))) {
    errors.push({ code: "hs_format", message: "hsCode looks invalid" });
  }
  return {
    engine: ENGINE,
    ok: errors.length === 0,
    errors,
    checked: REQUIRED,
    disclaimer: "Stub AI Documents. Checklist only; not a legal doc audit.",
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
    res.end(JSON.stringify({ ok: true, service: "documents", engine: ENGINE }));
    return;
  }
  try {
    if (req.method === "POST" && url.pathname === "/v1/validate") {
      res.end(JSON.stringify(validate(await readBody(req))));
      return;
    }
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found", hint: "POST /v1/validate" }));
});

server.listen(port, () => console.log(`[documents] ${ENGINE} on :${port}`));
