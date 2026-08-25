/**
 * Precedent typeahead HTTP service (C4 growth).
 * Contract: docs/contracts/d-suggest.json — POST /v1/suggest/query
 */
import http from "node:http";
import { PrismaClient } from "@prisma/client";
import { guardSuggestQuery } from "./query-guard.js";
import { searchPrecedentSuggestions } from "./search.js";

const port = Number(process.env.PORT || 4800);
const internalKey = process.env.INTERNAL_API_KEY || process.env.NEXTAUTH_SECRET || "";
const prisma = new PrismaClient();

const SUGGEST_KINDS = new Set([
  "itemName",
  "partyDescription",
  "shipCountry",
  "originCountry",
  "material",
  "brand",
  "composition",
]);

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function authOk(req) {
  if (!internalKey) return true;
  const key = req.headers["x-internal-key"];
  return key === internalKey;
}

async function handleSuggestQuery(req, res) {
  if (!authOk(req)) {
    return json(res, 401, { error: "Unauthorized" });
  }

  const userId = req.headers["x-user-id"];
  if (!userId || typeof userId !== "string") {
    return json(res, 400, { error: "x-user-id required" });
  }

  let raw;
  try {
    raw = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { error: "Invalid JSON" });
  }

  const kind = raw?.kind;
  if (!SUGGEST_KINDS.has(kind)) {
    return json(res, 400, { error: "Invalid kind" });
  }

  const q = raw?.q == null ? "" : String(raw.q);
  if (q.length > 120) {
    return json(res, 400, { error: "q too long" });
  }

  const limitRaw = raw?.limit == null ? 8 : Number(raw.limit);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(20, Math.max(1, Math.trunc(limitRaw)))
    : 8;

  try {
    const { items, rejected } = await searchPrecedentSuggestions(prisma, {
      kind,
      q,
      userId,
      limit,
    });
    const out = {
      engine: "precedent-suggest-v1",
      items,
      ...(rejected ? { rejected } : {}),
    };
    return json(res, 200, out);
  } catch (err) {
    console.error("[precedents] suggest/query failed", err);
    return json(res, 200, {
      engine: "precedent-suggest-v1",
      items: [],
      rejected: "error",
    });
  }
}

const server = http.createServer(async (req, res) => {
  const url = req.url?.split("?")[0] || "/";

  if (req.method === "GET" && url === "/health") {
    return json(res, 200, { ok: true, service: "precedents" });
  }

  if (req.method === "POST" && url === "/v1/suggest/query") {
    return handleSuggestQuery(req, res);
  }

  json(res, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`[precedents] listening on :${port}`);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect().catch(() => {});
  server.close(() => process.exit(0));
});
