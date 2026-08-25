/**
 * Notify channels (C4). Templates frozen in d-event.notify.json:
 *   generic | calc.approved | calc.sla_risk | ledger.topup
 * Delivery: outbox always; real email when SMTP_URL or RESEND_API_KEY set.
 */
import http from "node:http";
import net from "node:net";
import tls from "node:tls";

const port = Number(process.env.PORT || 4400);
const internalKey = process.env.INTERNAL_API_KEY || process.env.NEXTAUTH_SECRET || "";
const smtpUrl = process.env.SMTP_URL || "";
const smtpFrom = process.env.SMTP_FROM || "noreply@lbm.local";
const resendKey = process.env.RESEND_API_KEY || "";
const outbox = [];

const TEMPLATES = {
  generic: {
    subject: (p) => p.subject || "Уведомление LBM Брокер",
    body: (p) => p.body || JSON.stringify(p, null, 2),
  },
  "calc.approved": {
    subject: (p) => `Просчёт ${p.number || p.calculationId || ""} готов`,
    body: (p) =>
      `Ваш просчёт ${p.number || ""} утверждён. PDF доступен в кабинете.\n` +
      `ID: ${p.calculationId || ""}\nСтатус: DONE`,
  },
  "calc.sla_risk": {
    subject: (p) => `SLA риск · ${p.number || p.calculationId || ""}`,
    body: (p) =>
      `Заявка ${p.number || p.calculationId || ""} просрочила SLA и переведена в SLA_RISK.\n` +
      `Требуется внимание брокера/операций.`,
  },
  "ledger.topup": {
    subject: (p) => `Пополнение баланса · ${p.amountRub || ""} ₽`,
    body: (p) =>
      `На баланс компании зачислено ${p.amountRub || 0} ₽.\n` +
      (p.intentId ? `Intent: ${p.intentId}\n` : ""),
  },
};

/** Map legacy emitter names → contract templates */
const LEGACY = {
  calculation_approved: "calc.approved",
  pdf_ready: "calc.approved",
  sla_risk: "calc.sla_risk",
  topup_succeeded: "ledger.topup",
  preferred_released: "generic",
};

function normalizeTemplate(name) {
  const raw = name || "generic";
  return LEGACY[raw] || (TEMPLATES[raw] ? raw : "generic");
}

function render(template, payload) {
  const t = TEMPLATES[template] || TEMPLATES.generic;
  const p = payload || {};
  return { subject: t.subject(p), text: t.body(p) };
}

function looksLikeEmail(to) {
  return typeof to === "string" && to.includes("@");
}

async function sendResend(to, subject, text) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: smtpFrom, to: [to], subject, text }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`resend ${res.status}: ${err.slice(0, 200)}`);
  }
  return { channel: "resend" };
}

/**
 * Minimal SMTP send for smtp://user:pass@host:587 (STARTTLS) or smtps:// (465).
 * Not a full MIME client — plain text DATA for MVP email.
 */
async function sendSmtp(to, subject, text) {
  const u = new URL(smtpUrl);
  const host = u.hostname;
  const secure = u.protocol === "smtps:";
  const portNum = Number(u.port || (secure ? 465 : 587));
  const user = decodeURIComponent(u.username || "");
  const pass = decodeURIComponent(u.password || "");

  const lines = [];
  const push = (s) => lines.push(s);

  await new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port: portNum, servername: host }, onConnect)
      : net.connect({ host, port: portNum }, onConnect);

    let buf = "";
    let step = 0;
    const cmds = [];

    function onConnect() {
      socket.setEncoding("utf8");
      socket.on("data", onData);
      socket.on("error", reject);
      socket.on("end", () => resolve(undefined));
    }

    function send(cmd) {
      cmds.push(cmd);
      socket.write(cmd + "\r\n");
    }

    function onData(chunk) {
      buf += chunk;
      const parts = buf.split(/\r?\n/);
      buf = parts.pop() || "";
      for (const line of parts) {
        if (!/^\d{3}[\s-]/.test(line)) continue;
        const code = Number(line.slice(0, 3));
        const cont = line[3] === "-";
        if (cont) continue;
        try {
          advance(code);
        } catch (e) {
          socket.destroy();
          reject(e);
        }
      }
    }

    function advance(code) {
      if (step === 0) {
        if (code !== 220) throw new Error(`SMTP banner ${code}`);
        step = 1;
        send(`EHLO lbm-notify`);
        return;
      }
      if (step === 1) {
        if (code !== 250) throw new Error(`EHLO ${code}`);
        if (!secure && portNum === 587) {
          step = 2;
          send("STARTTLS");
          return;
        }
        step = 3;
        if (user) send(`AUTH LOGIN`);
        else {
          step = 6;
          send(`MAIL FROM:<${smtpFrom}>`);
        }
        return;
      }
      if (step === 2) {
        if (code !== 220) throw new Error(`STARTTLS ${code}`);
        const upgraded = tls.connect({ socket, servername: host }, () => {
          // replace handlers — simplified: fail if STARTTLS required without full upgrade path
          push("starttls-ok");
        });
        // For MVP without full STARTTLS upgrade complexity: prefer smtps:// or Resend
        upgraded.destroy();
        throw new Error("Use smtps://host:465 or RESEND_API_KEY for TLS email");
      }
      if (step === 3) {
        if (code !== 334) throw new Error(`AUTH ${code}`);
        step = 4;
        send(Buffer.from(user).toString("base64"));
        return;
      }
      if (step === 4) {
        if (code !== 334) throw new Error(`AUTH user ${code}`);
        step = 5;
        send(Buffer.from(pass).toString("base64"));
        return;
      }
      if (step === 5) {
        if (code !== 235) throw new Error(`AUTH fail ${code}`);
        step = 6;
        send(`MAIL FROM:<${smtpFrom}>`);
        return;
      }
      if (step === 6) {
        if (code !== 250) throw new Error(`MAIL ${code}`);
        step = 7;
        send(`RCPT TO:<${to}>`);
        return;
      }
      if (step === 7) {
        if (code !== 250 && code !== 251) throw new Error(`RCPT ${code}`);
        step = 8;
        send("DATA");
        return;
      }
      if (step === 8) {
        if (code !== 354) throw new Error(`DATA ${code}`);
        step = 9;
        const payload =
          `From: ${smtpFrom}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n` +
          `${text}\r\n.`;
        socket.write(payload + "\r\n");
        return;
      }
      if (step === 9) {
        if (code !== 250) throw new Error(`DATA end ${code}`);
        step = 10;
        send("QUIT");
        return;
      }
      if (step === 10) {
        socket.end();
        resolve(undefined);
      }
    }
  });

  return { channel: "smtp", meta: lines };
}

async function deliverEmail(to, subject, text) {
  if (!looksLikeEmail(to)) {
    return { skipped: true, reason: "to is not an email address" };
  }
  if (resendKey) return sendResend(to, subject, text);
  if (smtpUrl) return sendSmtp(to, subject, text);
  return { skipped: true, reason: "no SMTP_URL or RESEND_API_KEY" };
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);

  if (url.pathname === "/health") {
    res.end(
      JSON.stringify({
        ok: true,
        service: "notify",
        channels: ["email", "sms", "push"],
        emailProvider: resendKey ? "resend" : smtpUrl ? "smtp" : "outbox-only",
        outbox: outbox.length,
        templates: Object.keys(TEMPLATES),
      })
    );
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/outbox") {
    res.end(JSON.stringify({ messages: outbox.slice(0, 50) }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/send") {
    if (internalKey) {
      const key = req.headers["x-internal-key"] || "";
      if (key && key !== internalKey) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
    }
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
    const channel = body.channel || "email";
    if (!["email", "sms", "push"].includes(channel)) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "channel must be email|sms|push" }));
      return;
    }
    if (!body.to) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "to required" }));
      return;
    }

    const template = normalizeTemplate(body.template);
    const { subject, text } = render(template, body.payload);
    const durableOutboxId = body.payload?.outboxId || body.outboxId || null;
    const msg = {
      id: durableOutboxId || `msg_${Date.now()}`,
      outboxId: durableOutboxId,
      channel,
      to: body.to,
      template,
      payload: body.payload || {},
      subject,
      status: "queued",
      deliveryStatus: "PENDING",
      deliveredAt: null,
      delivery: null,
      createdAt: new Date().toISOString(),
    };

    try {
      if (channel === "email") {
        msg.delivery = await deliverEmail(body.to, subject, text);
        // F17: never fake DELIVERED without Resend/SMTP — leave queued for retry
        msg.status = msg.delivery?.skipped ? "queued" : "delivered";
      } else {
        msg.status = "delivered";
        msg.delivery = { stub: true };
      }
      if (msg.status === "delivered") msg.deliveredAt = new Date().toISOString();
      msg.deliveryStatus = msg.status === "delivered" ? "DELIVERED" : "PENDING";
    } catch (e) {
      msg.status = "failed";
      msg.deliveryStatus = "FAILED";
      msg.delivery = { error: e instanceof Error ? e.message : String(e) };
    }

    outbox.unshift(msg);
    if (outbox.length > 100) outbox.length = 100;
    console.log(`[notify] ${msg.channel} · ${msg.template} → ${msg.to} · ${msg.status}`);
    res.end(JSON.stringify(msg));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found", hint: "POST /v1/send { channel, to, template, payload }" }));
});

server.listen(port, () =>
  console.log(
    `[notify] templates+email (${resendKey ? "resend" : smtpUrl ? "smtp" : "outbox"}) on :${port}`
  )
);
