/**
 * Shared helpers for LLM-matrix stub services.
 */
export function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

export async function readJsonBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

export function corsPreflight(req, res) {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return true;
  }
  return false;
}

export function healthPayload(service, engine, extra = {}) {
  return { ok: true, service, engine, ...extra };
}
