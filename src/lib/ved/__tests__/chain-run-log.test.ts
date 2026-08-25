import { describe, expect, it } from "vitest";
import {
  analyzeCalcChain,
  appendChainRunStep,
  buildChainRunSnapshot,
  finishChainRun,
  mergeChainRunIntoDraft,
  readChainRun,
  startChainRun,
} from "../chain-run-log";

describe("chain-run-log", () => {
  it("starts, appends, finishes and merges into draft", () => {
    let log = startChainRun({ chainId: 3, attempt: 1, visionTransport: "mesh", classifyTransport: "mesh" });
    log = appendChainRunStep(log, { phase: "vision:ok", ok: true, ms: 1200, provider: "qwen-vl" });
    log = finishChainRun(log, { ok: true, hsCode: "8471 30 000 0", engine: "llm-openai-v1", confidence: 0.9 });
    const draft = mergeChainRunIntoDraft({ llmEnrich: "llm-openai-v1" }, log);
    expect(readChainRun(draft)?.result?.hsCode).toBe("8471 30 000 0");
    expect(readChainRun(draft)?.steps).toHaveLength(1);
  });

  it("builds snapshot from visionTrace + serviceCalls", () => {
    const snap = buildChainRunSnapshot({
      draft: {
        chainId: 3,
        visionTrace: [{ ts: "2026-08-23T10:00:00.000Z", phase: "vision-ok", ok: true, mode: "direct-qwen" }],
      },
      attempt: 1,
      visionTransport: "mesh",
      classifyTransport: "mesh",
      serviceCalls: [
        {
          service: "llm",
          operation: "classify",
          status: "OK",
          durationMs: 3200,
          createdAt: "2026-08-23T10:00:05.000Z",
          responseMeta: { engine: "llm-openai-v1" },
        },
      ],
      result: { ok: true, hsCode: "8471 30 000 0", engine: "llm-openai-v1" },
    });
    expect(snap.steps.map((s) => s.phase)).toEqual(["vision:vision-ok", "svc:llm/classify"]);
    expect(snap.result?.hsCode).toBe("8471 30 000 0");
  });

  it("analyzes calc for JSONL export", () => {
    const analysis = analyzeCalcChain({
      id: "c1",
      number: "#47999",
      status: "AI_READY",
      hsCode: "8471 30 000 0",
      confidence: 0.91,
      aiDraft: {
        chainId: 3,
        llmEnrich: "llm-openai-v1",
        llmEnrichPending: false,
        chainRun: startChainRun({ chainId: 3 }),
      },
      serviceCalls: [{ service: "llm", operation: "classify", status: "OK", durationMs: 2e3 }],
    });
    expect(analysis.pending).toBe(false);
    expect(analysis.chainId).toBe(3);
    expect(analysis.serviceCalls).toHaveLength(1);
    expect(analysis.timeline.some((t) => t.kind.startsWith("svc:"))).toBe(true);
  });
});
