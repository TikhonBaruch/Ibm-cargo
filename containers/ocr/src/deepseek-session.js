/**
 * DeepSeek vision describe (chain 3). Stateless — reset is a no-op skip.
 * OpenAI-compatible image_url; same envelope as Qwen describe.
 */

export function deepseekVisionConfig(env = process.env) {
  const key = String(env.DEEPSEEK_API_KEY || "").trim();
  const base = String(env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const model = String(
    env.DEEPSEEK_VISION_MODEL || "deepseek-v4-flash-vision-exp"
  ).trim();
  const timeoutMs = Number(env.OCR_TIMEOUT_MS || 90000);
  return { key, base, model, timeoutMs, configured: Boolean(key) };
}

const DESCRIBE_PROMPT =
  'Опиши товар на изображении для классификации ТН ВЭД. Ответь JSON: {"description":"<тип товара по-русски, 1 короткое предложение без назначения>","attrs":{"material":"","composition":"<из чего сделан>","purpose":"<для чего применяют>","extra":{"color":"","ageGroup":""}}}. Порядок: тип → состав → назначение. Не начинай description с назначения. Не выдумывай код ТН ВЭД.';

export function buildDeepseekDescribeMessages({ imageB64, mime, hint }) {
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
      messages,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    const err = new Error(`deepseek-vision ${res.status}: ${raw.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const json = JSON.parse(raw || "{}");
  let content = json.choices?.[0]?.message?.content || "{}";
  if (typeof content !== "string") content = JSON.stringify(content);
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) content = fence[1];
  try {
    return JSON.parse(content.trim() || "{}");
  } catch {
    return { description: content.trim(), attrs: {} };
  }
}

export async function describeWithDeepseek({ imageB64, mime, hint, env = process.env }) {
  const cfg = deepseekVisionConfig(env);
  if (!cfg.configured) {
    const err = new Error("DEEPSEEK_API_KEY missing");
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
      buildDeepseekDescribeMessages({ imageB64, mime, hint }),
      cfg.timeoutMs
    );
    return {
      engine: "deepseek-vision-v1",
      description: String(parsed.description || parsed.text || "").trim(),
      attrs: parsed.attrs && typeof parsed.attrs === "object" ? parsed.attrs : {},
      confidence: 0.7,
      disclaimer: "DeepSeek vision describe (deepseek-vision-v1). Broker QC required.",
      chainId: 3,
    };
  } finally {
    imageB64 = null;
  }
}

/** Stateless provider — nothing to clear. */
export async function resetDeepseekSession() {
  return { ok: true, skipped: true, engine: "deepseek-reset-v1" };
}
