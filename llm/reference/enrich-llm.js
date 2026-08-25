/**
 * S6: optional LLM enrich on top of heuristic draft.
 * Fail-open: any LLM/network error returns the original draft unchanged.
 * SOURCE: taurus/containers/ai/src/enrich-llm.js — reference only.
 *
 * @param {object} body request body (description, title, shipmentValue, …)
 * @param {object} draft heuristic AiDraftResult
 * @param {{ llmUrl?: string, fetchFn?: typeof fetch }} [opts]
 */
export async function enrichWithLlm(body, draft, opts = {}) {
  const llmUrl = String(opts.llmUrl ?? process.env.LLM_SERVICE_URL ?? "").replace(/\/$/, "");
  if (!llmUrl) return draft;

  const fetchFn = opts.fetchFn ?? globalThis.fetch;
  try {
    const [cRes, dRes] = await Promise.all([
      fetchFn(`${llmUrl}/v1/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(3000),
      }),
      fetchFn(`${llmUrl}/v1/duty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hsCode: draft.hsCode,
          shipmentValue: body.shipmentValue,
        }),
        signal: AbortSignal.timeout(3000),
      }),
    ]);
    if (!cRes.ok) return draft;
    const classified = await cRes.json();
    let duties = draft.duties;
    if (dRes.ok) {
      const d = await dRes.json();
      duties = {
        customsDutyPercent: d.customsDutyPercent ?? draft.duties.customsDutyPercent,
        vatPercent: d.vatPercent ?? draft.duties.vatPercent,
        feeRub: d.feeRub ?? draft.duties.feeRub,
        note: `heuristic+llm-stub · ${draft.duties.note || ""}`.trim(),
      };
    }
    let hsCode = classified.hsCode || draft.hsCode;
    if (classified.hsCode && classified.hsCode !== draft.hsCode) {
      try {
        const d2 = await fetchFn(`${llmUrl}/v1/duty`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hsCode: classified.hsCode, shipmentValue: body.shipmentValue }),
          signal: AbortSignal.timeout(3000),
        });
        if (d2.ok) {
          const d = await d2.json();
          duties = {
            customsDutyPercent: d.customsDutyPercent ?? duties.customsDutyPercent,
            vatPercent: d.vatPercent ?? duties.vatPercent,
            feeRub: d.feeRub ?? duties.feeRub,
            note: `llm-stub-v0 · classify+duty`,
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
      engine: "heuristic-v1",
      llmEnrich: classified.engine || "llm",
    };
  } catch {
    return draft;
  }
}
