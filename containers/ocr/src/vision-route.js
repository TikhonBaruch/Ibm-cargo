/**
 * Pick OCR vision backend from request chainId or AI_CHAIN_ID.
 * Model ≠ container: chain 3 = DeepSeek vision; 1/2 = Qwen-VL.
 */

export function resolveVisionProvider(body = {}, env = process.env) {
  const raw = String(
    body.chainId ?? body.chain ?? env.AI_CHAIN_ID ?? env.LLM_CHAIN_ID ?? "3"
  )
    .trim()
    .toLowerCase();
  if (raw === "3" || raw === "deepseek") return "deepseek";
  return "qwen";
}
