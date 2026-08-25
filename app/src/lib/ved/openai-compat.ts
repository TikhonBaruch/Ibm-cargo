/**
 * Resolve one OpenAI-compatible chat endpoint from env.
 * Profiles (LLM_PROVIDER): deepseek | qwen | nvidia | (unset = OPENAI_*).
 * Chain: LLM_CLASSIFY_CHAIN=deepseek,qwen (failover order).
 * Mirror of containers/llm openai-compat — Vercel path without LLM_SERVICE_URL.
 */
export type OpenAiCompat = {
  profile: string;
  key: string;
  base: string;
  classifyModel: string;
};

export function resolveOpenAiCompat(
  env: NodeJS.ProcessEnv = process.env,
  providerOverride?: string
): OpenAiCompat {
  const provider = String(providerOverride ?? env.LLM_PROVIDER ?? "")
    .trim()
    .toLowerCase();

  if (provider === "deepseek") {
    return {
      profile: "deepseek",
      key: String(env.DEEPSEEK_API_KEY || "").trim(),
      base: String(env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, ""),
      classifyModel: String(env.DEEPSEEK_MODEL || "deepseek-chat").trim(),
    };
  }

  if (provider === "qwen") {
    return {
      profile: "qwen",
      key: String(env.QWEN_API_KEY || "").trim(),
      base: String(env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(
        /\/$/,
        ""
      ),
      classifyModel: String(env.QWEN_MODEL || "qwen-plus").trim(),
    };
  }

  const key = String(env.OPENAI_API_KEY || "").trim();
  const base = String(env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const classifyModel = String(
    env.LLM_CLASSIFY_MODEL || env.OPENAI_MODEL || "gpt-4o-mini"
  ).trim();

  if (provider === "nvidia") {
    return {
      profile: "nvidia",
      key,
      base: base.includes("nvidia") ? base : "https://integrate.api.nvidia.com/v1",
      classifyModel: env.LLM_CLASSIFY_MODEL?.trim() || "meta/llama-3.1-8b-instruct",
    };
  }

  let profile = "openai";
  if (base.includes("nvidia")) profile = "nvidia";
  else if (base.includes("deepseek")) profile = "deepseek";
  else if (base.includes("dashscope")) profile = "qwen";

  return { profile, key, base, classifyModel };
}

/**
 * Ordered classify providers with keys present.
 * Default: LLM_PROVIDER first, then deepseek, qwen (deduped).
 * Override: LLM_CLASSIFY_CHAIN=deepseek,qwen
 */
export function resolveClassifyChain(env: NodeJS.ProcessEnv = process.env): OpenAiCompat[] {
  const raw = String(env.LLM_CLASSIFY_CHAIN || "").trim();
  const names = raw
    ? raw
        .split(/[,;\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [
        String(env.LLM_PROVIDER || "deepseek").trim().toLowerCase() || "deepseek",
        "deepseek",
        "qwen",
      ];
  const seen = new Set<string>();
  const out: OpenAiCompat[] = [];
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    const compat = resolveOpenAiCompat(env, name);
    if (compat.key) out.push(compat);
  }
  if (!out.length) {
    const primary = resolveOpenAiCompat(env);
    if (primary.key) out.push(primary);
  }
  return out;
}

/** True when classify can run without LLM_SERVICE_URL (keys on Vercel / Mode A). */
export function providerClassifyConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveClassifyChain(env).length > 0;
}

export function qwenVisionConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(String(env.QWEN_API_KEY || "").trim());
}

/** DeepSeek multimodal (chain 3). Same API key as classify. */
export function deepseekVisionConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(String(env.DEEPSEEK_API_KEY || "").trim());
}
