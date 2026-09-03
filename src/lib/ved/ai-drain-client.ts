/**
 * Client-safe AI_DRAIN wait helpers (no Prisma / Node fetch to providers).
 * Accurate HS: poll until llmEnrichPending clears (≤5 min; vision 90s + classify + retries).
 * C39: payAfter path uses a short cap so wizard is not stuck on «Уточняем…» before pay.
 */

export const AI_ENRICH_WAIT_MS = 300_000;
/** Cap before pay on /cabinet/new stayOnNew — then poll continues on step 3. */
export const AI_ENRICH_BEFORE_PAY_MS = 15_000;
export const AI_ENRICH_POLL_MS = 2_500;

export function isAiDrainPending(calc: {
  aiDrainPending?: boolean;
  aiDraft?: unknown;
}): boolean {
  if (calc.aiDrainPending === true) return true;
  const draft = calc.aiDraft;
  if (draft && typeof draft === "object" && !Array.isArray(draft)) {
    return (draft as { llmEnrichPending?: boolean }).llmEnrichPending === true;
  }
  return false;
}

export async function waitForAiEnrich<T extends { id: string; aiDraft?: unknown; aiDrainPending?: boolean }>(
  calc: T,
  fetchCalc: (id: string) => Promise<T>,
  opts: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<T> {
  if (!isAiDrainPending(calc)) return calc;
  const timeoutMs = opts.timeoutMs ?? AI_ENRICH_WAIT_MS;
  const intervalMs = opts.intervalMs ?? AI_ENRICH_POLL_MS;
  const deadline = Date.now() + timeoutMs;
  let latest = calc;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    latest = await fetchCalc(calc.id);
    if (!isAiDrainPending(latest)) return latest;
  }
  return latest;
}
