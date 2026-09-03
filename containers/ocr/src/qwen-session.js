/**
 * Qwen-VL describe + post-call reset (stateless; no session_id / history).
 * Reset is fail-open for the caller — never mix previous image into next job.
 */

export function qwenVisionConfig(env = process.env) {
  const key = String(env.QWEN_API_KEY || "").trim();
  const base = String(env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(
    /\/$/,
    ""
  );
  const model = String(env.QWEN_VISION_MODEL || "qwen-vl-plus").trim();
  const timeoutMs = Number(env.OCR_TIMEOUT_MS || 90000);
  return { key, base, model, timeoutMs, configured: Boolean(key) };
}

const DESCRIBE_PROMPT =
  'Опиши товар на изображении для классификации ТН ВЭД. Ответь JSON: {"description":"<тип товара по-русски, 1 короткое предложение без назначения>","attrs":{"material":"","composition":"<из чего сделан>","purpose":"<для чего применяют>","extra":{"color":"","ageGroup":""}}}. Порядок: тип → состав → назначение. Не начинай description с назначения. Не выдумывай код ТН ВЭД.';

const RESET_PROMPT =
  'Reset context. Ignore any previous image. Reply JSON {"ok":true}.';

export function buildDescribeMessages({ imageB64, mime, hint }) {
  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `${DESCRIBE_PROMPT} Hint: ${hint || ""}`.trim(),
        },
        {
          type: "image_url",
          image_url: { url: `data:${mime || "image/jpeg"};base64,${imageB64}` },
        },
      ],
    },
  ];
}

export function buildResetMessages() {
  return [{ role: "user", content: RESET_PROMPT }];
}

async function chatCompletions(cfg, messages, timeoutMs) {
  const res = await fetch(`${cfg.base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.key}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    const err = new Error(`qwen ${res.status}: ${raw.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const json = JSON.parse(raw || "{}");
  const content = json.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content);
}

export async function describeWithQwen({ imageB64, mime, hint, env = process.env }) {
  const cfg = qwenVisionConfig(env);
  if (!cfg.configured) {
    const err = new Error("QWEN_API_KEY missing");
    err.status = 503;
    throw err;
  }
  if (!imageB64) {
    const err = new Error("image required");
    err.status = 400;
    throw err;
  }
  try {
    const parsed = await chatCompletions(
      cfg,
      buildDescribeMessages({ imageB64, mime, hint }),
      cfg.timeoutMs
    );
    return {
      engine: "qwen-vl-v1",
      description: String(parsed.description || parsed.text || "").trim(),
      attrs: parsed.attrs && typeof parsed.attrs === "object" ? parsed.attrs : {},
      confidence: 0.72,
      disclaimer: "Qwen-VL describe (qwen-vl-v1). Broker QC required.",
    };
  } finally {
    imageB64 = null;
  }
}

export async function resetQwenSession({ env = process.env } = {}) {
  const cfg = qwenVisionConfig(env);
  if (!cfg.configured) {
    return { ok: true, skipped: true, engine: "qwen-reset-v1" };
  }
  try {
    await chatCompletions(cfg, buildResetMessages(), Number(env.OCR_RESET_TIMEOUT_MS || 8000));
    return { ok: true, engine: "qwen-reset-v1" };
  } catch (e) {
    return {
      ok: false,
      engine: "qwen-reset-v1",
      error: e instanceof Error ? e.message : "qwen reset failed",
    };
  }
}
