/**
 * In-process email delivery when NOTIFY_SERVICE_URL is unset (Vercel dual-path).
 * Prefer RESEND_API_KEY; SMTP_URL left to containers/notify (STARTTLS complexity).
 */
const TEMPLATES: Record<
  string,
  { subject: (p: Record<string, unknown>) => string; body: (p: Record<string, unknown>) => string }
> = {
  generic: {
    subject: (p) => String(p.subject || "Уведомление LBM Брокер"),
    body: (p) => String(p.body || JSON.stringify(p, null, 2)),
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
  "chat.message": {
    subject: (p) => `Новое сообщение · ${p.number || p.calculationId || "заявка"}`,
    body: (p) =>
      `Новое сообщение по заявке ${p.number || ""}.\n` +
      `${p.preview || ""}\n\n` +
      `Откройте кабинет для ответа.`,
  },
  "chat.support_new": {
    subject: (p) => `Support · ${p.subject || "новое обращение"}`,
    body: (p) =>
      `Новое обращение в поддержку: ${p.subject || ""}\n` +
      `${p.preview || ""}\n\n` +
      `Thread: ${p.threadId || ""}`,
  },
  "chat.support_reply": {
    subject: (p) => `Ответ поддержки · ${p.subject || ""}`,
    body: (p) =>
      `Ответ по обращению «${p.subject || ""}»:\n` +
      `${p.preview || ""}\n\n` +
      `Откройте /cabinet/support`,
  },
};

const LEGACY: Record<string, string> = {
  calculation_approved: "calc.approved",
  pdf_ready: "calc.approved",
  sla_risk: "calc.sla_risk",
  topup_succeeded: "ledger.topup",
};

function normalizeTemplate(name?: string) {
  const raw = name || "generic";
  return LEGACY[raw] || (TEMPLATES[raw] ? raw : "generic");
}

export function canSendInlineEmail() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendInlineEmail(opts: {
  to: string;
  template: string;
  payload?: Record<string, unknown>;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string; channel?: string }> {
  const to = opts.to;
  if (!to || !to.includes("@")) {
    return { ok: true, skipped: true };
  }
  const key = process.env.RESEND_API_KEY || "";
  if (!key) {
    return { ok: true, skipped: true };
  }
  const from = process.env.SMTP_FROM || "noreply@lbm.local";
  const tpl = normalizeTemplate(opts.template);
  const t = TEMPLATES[tpl] || TEMPLATES.generic;
  const p = opts.payload || {};
  const subject = t.subject(p);
  const text = t.body(p);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { ok: false, error: `resend ${res.status}: ${err.slice(0, 200)}` };
    }
    return { ok: true, channel: "resend" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
