import type { EnvBag } from "../../env-bag";
/**
 * Parallel AI chain profiles (1 nvidia · 2 qwen+deepseek · 3 deepseek-only).
 * Model ≠ Docker service (D35). See docs/knowledge/plan-ai-chains-1-2-3.md
 */

export type AiChainId = 1 | 2 | 3;

export type AiChainSlug = "nvidia" | "qwen-deepseek" | "deepseek";

export type AiChainMeta = {
  id: AiChainId;
  slug: AiChainSlug;
  label: string;
  /** Vision provider key for logs / soft-fail. */
  vision: "nvidia" | "qwen" | "deepseek" | "none";
  /** Default LLM_CLASSIFY_CHAIN override when unset on env for this chain. */
  classifyChainDefault: string;
};

export const AI_CHAINS: Record<AiChainId, AiChainMeta> = {
  1: {
    id: 1,
    slug: "nvidia",
    label: "NVIDIA NIM (legacy)",
    vision: "nvidia",
    classifyChainDefault: "nvidia",
  },
  2: {
    id: 2,
    slug: "qwen-deepseek",
    label: "Qwen-VL + DeepSeek",
    vision: "qwen",
    classifyChainDefault: "deepseek,qwen",
  },
  3: {
    id: 3,
    slug: "deepseek",
    label: "DeepSeek only",
    vision: "deepseek",
    classifyChainDefault: "deepseek",
  },
};

/** Resolve active chain. Default 3 (DeepSeek vision + classify). */
export function resolveAiChainId(env: EnvBag = process.env): AiChainId {
  const raw = String(env.AI_CHAIN_ID || env.LLM_CHAIN_ID || "3").trim().toLowerCase();
  if (raw === "1" || raw === "nvidia") return 1;
  if (raw === "3" || raw === "deepseek") return 3;
  if (raw === "2" || raw === "qwen-deepseek" || raw === "hybrid") return 2;
  const n = Number(raw);
  if (n === 1 || n === 2 || n === 3) return n as AiChainId;
  return 3;
}

export function aiChainMeta(id: AiChainId = resolveAiChainId()): AiChainMeta {
  return AI_CHAINS[id];
}

/**
 * Env view for classify: force chain-specific LLM_CLASSIFY_CHAIN when caller did not set one
 * on chain 3 (always deepseek-only), or when AI_CHAIN forces defaults.
 */
export function classifyEnvForChain(
  chainId: AiChainId,
  env: EnvBag = process.env
): EnvBag {
  const meta = AI_CHAINS[chainId];
  if (chainId === 3) {
    return { ...env, LLM_CLASSIFY_CHAIN: "deepseek", LLM_PROVIDER: "deepseek" };
  }
  if (chainId === 1) {
    return {
      ...env,
      LLM_CLASSIFY_CHAIN: String(env.LLM_CLASSIFY_CHAIN || meta.classifyChainDefault),
      LLM_PROVIDER: String(env.LLM_PROVIDER || "nvidia"),
    };
  }
  // Chain 2: keep explicit LLM_CLASSIFY_CHAIN if set; else default hybrid.
  if (!String(env.LLM_CLASSIFY_CHAIN || "").trim()) {
    return { ...env, LLM_CLASSIFY_CHAIN: meta.classifyChainDefault };
  }
  return env;
}
