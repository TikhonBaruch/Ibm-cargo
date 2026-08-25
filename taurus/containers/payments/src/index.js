/**
 * Payments / acquiring (C4). Envelope: checkout → webhook TOPUP (d-ledger.json).
 * Intent id is owned by domain (PaymentIntent row); this service caches + talks to YooKassa.
 * Default: stub auto-confirm. With YOOKASSA_* → pending + confirmUrl; webhook verifies via API.
 */
import http from "node:http";
const port = Number(process.env.PORT || 4300);
const webhookTarget = process.env.WEBHOOK_TARGET || "http://api:4000/v1/webhooks/payments";
const internalKey = process.env.INTERNAL_API_KEY || process.env.NEXTAUTH_SECRET || "";
const publicBase = (process.env.PAYMENTS_PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, "");
const yooShopId = process.env.YOOKASSA_SHOP_ID || "";
const yooSecret = process.env.YOOKASSA_SECRET_KEY || "";
const yooEnabled = Boolean(yooShopId && yooSecret);
const providerName = yooEnabled ? "yookassa" : "stub";

/** Cache only — durable source of truth is domain PaymentIntent + ledger. */
const payments = new Map();
const METHODS = new Set(["stub", "sbp", "card", "yookassa"]);

function yooAuthHeader() {
  return `Basic ${Buffer.from(`${yooShopId}:${yooSecret}`).toString("base64")}`;
}

async function fireWebhook(intent) {
  try {
    const res = await fetch(webhookTarget, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": internalKey,
      },
      body: JSON.stringify({
        intentId: intent.id,
        id: intent.id,
        companyId: intent.companyId,
        amountRub: intent.amountRub,
        provider: intent.provider,
        method: intent.method,
        userId: intent.userId || null,
        status: intent.status,
      }),
      signal: AbortSignal.timeout(5000),
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function createYooPayment(intent) {
  const returnUrl =
    process.env.YOOKASSA_RETURN_URL ||
    `${publicBase}/v1/intents/${intent.id}/return`;
  const res = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: yooAuthHeader(),
      "Idempotence-Key": intent.id,
    },
    body: JSON.stringify({
      amount: { value: Number(intent.amountRub).toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: returnUrl },
      description: `Topup ${intent.companyId}`,
      metadata: {
        intentId: intent.id,
        companyId: intent.companyId,
        userId: intent.userId || "",
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`yookassa ${res.status}: ${err.slice(0, 240)}`);
  }
  return res.json();
}

/** Authenticity: re-fetch payment from YooKassa (official verify path). */
async function verifyYooPayment(providerPaymentId) {
  if (!yooEnabled || !providerPaymentId) return null;
  const res = await fetch(`https://api.yookassa.ru/v3/payments/${providerPaymentId}`, {
    headers: { Authorization: yooAuthHeader() },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  return res.json();
}

function assertYooBasicAuth(req) {
  if (!yooEnabled) return true;
  if (process.env.YOOKASSA_SKIP_BASIC_AUTH === "1") return true;
  const hdr = req.headers.authorization || "";
  if (!hdr.startsWith("Basic ")) return false;
  const decoded = Buffer.from(hdr.slice(6), "base64").toString("utf8");
  const expected = `${yooShopId}:${yooSecret}`;
  return decoded === expected;
}

async function createIntent(body) {
  const amountRub = Number(body.amountRub) || 0;
  if (amountRub <= 0) throw new Error("amountRub must be > 0");
  if (!body.companyId) throw new Error("companyId required");
  let method = METHODS.has(body.method) ? body.method : "stub";
  if (method === "yookassa" && !yooEnabled) {
    throw new Error("YooKassa not configured (YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY)");
  }
  const useYoo = yooEnabled && method !== "stub";
  const id = body.intentId || body.id || crypto.randomUUID();

  const intent = {
    id,
    amountRub,
    companyId: body.companyId,
    userId: body.userId || null,
    method: useYoo ? (method === "stub" ? "card" : method) : "stub",
    status: "pending",
    provider: useYoo ? "yookassa" : "stub",
    createdAt: new Date().toISOString(),
    confirmUrl: `${publicBase}/v1/intents/${id}/confirm`,
    webhookTarget,
  };

  if (useYoo) {
    const payment = await createYooPayment(intent);
    intent.providerPaymentId = payment.id;
    intent.confirmUrl = payment.confirmation?.confirmation_url || intent.confirmUrl;
    intent.providerStatus = payment.status;
  }

  payments.set(id, intent);
  return intent;
}

async function confirmIntent(id) {
  const intent = payments.get(id);
  if (!intent) return null;
  if (intent.status === "succeeded") {
    return { ...intent, note: "already confirmed" };
  }
  if (intent.provider === "yookassa" && !intent._forceConfirm) {
    return {
      ...intent,
      note: "awaiting_provider",
      status: "pending",
    };
  }
  intent.status = "succeeded";
  intent.paidAt = new Date().toISOString();
  intent.webhook = await fireWebhook(intent);
  return intent;
}

async function markSucceededFromProvider(intentId, providerPaymentId, verified) {
  let intent = intentId ? payments.get(intentId) : null;
  if (!intent && providerPaymentId) {
    intent = [...payments.values()].find((p) => p.providerPaymentId === providerPaymentId) || null;
  }
  if (!intent && verified?.metadata?.companyId) {
    intent = {
      id: intentId || providerPaymentId || crypto.randomUUID(),
      amountRub: Math.round(Number(verified.amount?.value || 0)),
      companyId: verified.metadata.companyId,
      userId: verified.metadata.userId || null,
      method: "yookassa",
      status: "pending",
      provider: "yookassa",
      providerPaymentId,
    };
    payments.set(intent.id, intent);
  }
  if (!intent) return null;
  if (intent.status === "succeeded") return intent;
  intent.status = "succeeded";
  intent.paidAt = new Date().toISOString();
  intent.providerPaymentId = providerPaymentId || intent.providerPaymentId;
  intent.webhook = await fireWebhook(intent);
  return intent;
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
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);

  if (url.pathname === "/health") {
    res.end(
      JSON.stringify({
        ok: true,
        service: "payments",
        provider: providerName,
        webhookTarget,
        yookassa: yooEnabled,
        durableIntents: "domain-PaymentIntent",
      })
    );
    return;
  }

  try {
    if (req.method === "POST" && url.pathname === "/v1/intents") {
      const body = await readBody(req);
      const intent = await createIntent(body);
      res.end(JSON.stringify(intent));
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/checkout") {
      const body = await readBody(req);
      const intent = await createIntent({
        ...body,
        method: body.method || "stub",
      });
      if (intent.provider === "stub") {
        const confirmed = await confirmIntent(intent.id);
        res.end(JSON.stringify({ intent: confirmed, webhook: confirmed?.webhook || null }));
        return;
      }
      res.end(
        JSON.stringify({
          intent,
          webhook: null,
          pending: true,
          confirmUrl: intent.confirmUrl,
        })
      );
      return;
    }

    const confirm = url.pathname.match(/^\/v1\/intents\/([^/]+)\/confirm$/);
    if (req.method === "POST" && confirm) {
      const intent = payments.get(confirm[1]);
      if (intent?.provider === "stub") {
        const confirmed = await confirmIntent(confirm[1]);
        if (!confirmed) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Not found" }));
          return;
        }
        res.end(JSON.stringify(confirmed));
        return;
      }
      if (process.env.ALLOW_FORCE_CONFIRM === "1" && intent) {
        intent._forceConfirm = true;
        const confirmed = await confirmIntent(confirm[1]);
        res.end(JSON.stringify(confirmed));
        return;
      }
      res.statusCode = 409;
      res.end(
        JSON.stringify({
          error: "Awaiting provider payment",
          confirmUrl: intent?.confirmUrl,
          status: intent?.status || "pending",
        })
      );
      return;
    }

    /** Browser return after YooKassa — informational redirect page. */
    const ret = url.pathname.match(/^\/v1\/intents\/([^/]+)\/return$/);
    if (req.method === "GET" && ret) {
      const cabinet =
        process.env.YOOKASSA_RETURN_URL ||
        process.env.CABINET_BALANCE_URL ||
        "http://localhost:3000/cabinet/balance?topup=1";
      res.statusCode = 302;
      res.setHeader("Location", cabinet.includes("?") ? `${cabinet}&intentId=${ret[1]}` : `${cabinet}?topup=1&intentId=${ret[1]}`);
      res.end();
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/webhooks/yookassa") {
      if (!assertYooBasicAuth(req)) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
      const body = await readBody(req);
      const event = body.event || body.type || "";
      const obj = body.object || body;
      const providerPaymentId = obj.id;
      const verified = providerPaymentId ? await verifyYooPayment(providerPaymentId) : null;
      if (!verified || verified.status !== "succeeded") {
        if (!String(event).includes("succeeded") && obj.status !== "succeeded") {
          res.end(JSON.stringify({ ok: true, ignored: true, event }));
          return;
        }
        if (!verified) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: "Payment verification failed" }));
          return;
        }
      }
      const intentId = verified?.metadata?.intentId || obj.metadata?.intentId || body.intentId;
      const intent = await markSucceededFromProvider(intentId, providerPaymentId, verified || obj);
      if (!intent) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Unknown payment" }));
        return;
      }
      res.end(JSON.stringify({ ok: true, intent, webhook: intent.webhook }));
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/v1/intents/")) {
      const id = url.pathname.split("/").pop();
      const intent = payments.get(id);
      if (!intent) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }
      res.end(JSON.stringify(intent));
      return;
    }
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }));
    return;
  }

  res.statusCode = 404;
  res.end(
    JSON.stringify({
      error: "Not found",
      hint: "POST /v1/intents | /v1/checkout | …/confirm | /v1/webhooks/yookassa",
    })
  );
});

server.listen(port, () =>
  console.log(`[payments] provider=${providerName} webhook→${webhookTarget} on :${port}`)
);
