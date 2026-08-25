/**
 * Optional LLM enrich on heuristic draft (S6 / P1b). Fail-open.
 * Prefer LLM_SERVICE_URL; else direct DeepSeek/Qwen via provider keys (Vercel).
 */
import { prisma } from "@/lib/prisma";
import type { AiDraftResult } from "./domain";
import { providerClassifyConfigured } from "./openai-compat";
import { classifyWithProvider } from "./provider-mesh";

export async function enrichDraftWithLlm(
  body: {
    title?: string;
    description?: string;
    name?: string;
    country?: string;
    shipmentValue?: string | number;
  },
  draft: AiDraftResult,
  opts: { llmUrl?: string; fetchFn?: typeof fetch } = {}
): Promise<AiDraftResult> {
  const llmUrl = String(opts.llmUrl ?? process.env.LLM_SERVICE_URL ?? "").replace(/\/$/, "");
  const fetchFn = opts.fetchFn ?? globalThis.fetch;

  if (llmUrl) {
    try {
      const [cRes, dRes] = await Promise.all([
        fetchFn(`${llmUrl}/v1/classify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || 90000)),
        }),
        fetchFn(`${llmUrl}/v1/duty`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hsCode: draft.hsCode,
            shipmentValue: body.shipmentValue,
          }),
          signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || 90000)),
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
            signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || 90000)),
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

  if (!providerClassifyConfigured()) return draft;
  try {
    const classified = await classifyWithProvider(prisma, {
      title: body.title,
      description: body.description,
      name: body.name || body.title,
      country: body.country,
    });
    if (!classified) return draft;
    return {
      ...draft,
      hsCode: classified.hsCode,
      confidence: classified.confidence,
      disclaimer: classified.disclaimer || draft.disclaimer,
      engine: draft.engine || "heuristic-v1",
      llmEnrich: classified.engine,
    };
  } catch {
    return draft;
  }
}
