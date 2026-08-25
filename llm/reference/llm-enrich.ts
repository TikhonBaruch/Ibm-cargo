/**
 * Optional LLM enrich on heuristic draft (S6 / P1b). Fail-open.
 * Mirrors containers/ai enrich-llm.js for Next dual-path without AI container.
 * SOURCE: src/lib/ved/llm-enrich.ts — reference only; do not import from LBM.
 */
import type { AiDraftResult } from "./domain";

export async function enrichDraftWithLlm(
  body: {
    title?: string;
    description?: string;
    country?: string;
    shipmentValue?: string | number;
  },
  draft: AiDraftResult,
  opts: { llmUrl?: string; fetchFn?: typeof fetch } = {}
): Promise<AiDraftResult> {
  const llmUrl = String(opts.llmUrl ?? process.env.LLM_SERVICE_URL ?? "").replace(/\/$/, "");
  if (!llmUrl) return draft;

  const fetchFn = opts.fetchFn ?? globalThis.fetch;
  try {
    const [cRes, dRes] = await Promise.all([
      fetchFn(`${llmUrl}/v1/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || 3000)),
      }),
      fetchFn(`${llmUrl}/v1/duty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hsCode: draft.hsCode,
          shipmentValue: body.shipmentValue,
        }),
        signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || 3000)),
      }),
    ]);
    if (!cRes.ok) return draft;
    const classified = (await cRes.json()) as {
      hsCode?: string;
      confidence?: number;
      disclaimer?: string;
      engine?: string;
    };
    let duties = draft.duties;
    if (dRes.ok) {
      const d = (await dRes.json()) as {
        customsDutyPercent?: number;
        vatPercent?: number;
        feeRub?: number;
      };
      duties = {
        customsDutyPercent: d.customsDutyPercent ?? draft.duties.customsDutyPercent,
        vatPercent: d.vatPercent ?? draft.duties.vatPercent,
        feeRub: d.feeRub ?? draft.duties.feeRub,
        note: `heuristic+llm · ${draft.duties.note || ""}`.trim(),
      };
    }
    let hsCode = classified.hsCode || draft.hsCode;
    if (classified.hsCode && classified.hsCode !== draft.hsCode) {
      try {
        const d2 = await fetchFn(`${llmUrl}/v1/duty`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hsCode: classified.hsCode,
            shipmentValue: body.shipmentValue,
          }),
          signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || 3000)),
        });
        if (d2.ok) {
          const d = (await d2.json()) as {
            customsDutyPercent?: number;
            vatPercent?: number;
            feeRub?: number;
          };
          duties = {
            customsDutyPercent: d.customsDutyPercent ?? duties.customsDutyPercent,
            vatPercent: d.vatPercent ?? duties.vatPercent,
            feeRub: d.feeRub ?? duties.feeRub,
            note: "llm · classify+duty",
          };
        }
      } catch {
        /* keep duties */
      }
      hsCode = classified.hsCode;
    }
    return {
      ...draft,
      hsCode,
      confidence: classified.confidence ?? draft.confidence,
      duties,
      disclaimer: classified.disclaimer || draft.disclaimer,
      engine: draft.engine || "heuristic-v1",
      llmEnrich: classified.engine || "llm",
    };
  } catch {
    return draft;
  }
}
