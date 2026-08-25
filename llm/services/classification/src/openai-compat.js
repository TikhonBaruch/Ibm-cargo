/**
 * Resolve one OpenAI-compatible chat endpoint from env.
 * Profiles (LLM_PROVIDER): deepseek | qwen | nvidia | (unset = OPENAI_*).
 * Not a multi-LLM router — one active provider. Engine tag stays llm-openai-v1.
 */
export function resolveOpenAiCompat(env = process.env) {
  const provider = String(env.LLM_PROVIDER || "")
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
