/**
 * Mode B AI_DRAIN: OCR describe(+chainId) → reset → LLM classify(+chainId).
 * Mirror of src/lib/ved/ai-pipeline.ts (service transport only).
 */
import { createHash } from "node:crypto";
import { isAllowedMediaUrl } from "./media-url.js";
import { shouldSkipLlmClassify } from "./llm-skip-gate.js";

function resolveAiChainId(env = process.env) {
  const raw = String(env.AI_CHAIN_ID || env.LLM_CHAIN_ID || "3").trim().toLowerCase();
  if (raw === "1" || raw === "nvidia") return 1;
  if (raw === "3" || raw === "deepseek") return 3;
  if (raw === "2" || raw === "qwen-deepseek" || raw === "hybrid") return 2;
  const n = Number(raw);
  if (n === 1 || n === 2 || n === 3) return n;
  return 3;
}

export function shouldEnqueueAiDrain(settings, env = process.env) {
  if (settings?.llmEnrichEnabled === false) return false;
  const ocr = String(env.OCR_SERVICE_URL || "").replace(/\/$/, "");
  const llm = String(env.LLM_SERVICE_URL || "").replace(/\/$/, "");
  return Boolean(ocr || llm);
}

export function mediaUrlMeta(url) {
  const raw = String(url || "").trim();
  if (!raw) return { present: false };
  return {
    present: true,
    length: raw.length,
    suffix: raw.slice(-32),
    sha256: createHash("sha256").update(raw).digest("hex").slice(0, 16),
  };
}

function classifyServiceError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  const name = String(err?.name || "");
  if (
    name === "TimeoutError" ||
    name === "AbortError" ||
    msg.includes("timeout") ||
    msg.includes("aborted") ||
    msg.includes("timed out")
  ) {
    return "TIMEOUT";
  }
  return "FAILED";
}

async function callJson(url, body, timeoutMs) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function runAiDrainPipeline(prisma, { calculationId, recordCall, completeCall }) {
  const ocrUrl = String(process.env.OCR_SERVICE_URL || "").replace(/\/$/, "");
  const llmUrl = String(process.env.LLM_SERVICE_URL || "").replace(/\/$/, "");
  const chainId = resolveAiChainId();
  if (!ocrUrl && !llmUrl) return { ok: true, skipped: true };

  const calc = await prisma.calculation.findUnique({
    where: { id: calculationId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!calc) return { ok: false, error: "calculation not found" };

  const item = calc.items[0];
  const hint = [item?.name, calc.title, calc.description].filter(Boolean).join(" ").trim();
  let visionDescription = null;
  let describeFailed = null;
  const mediaUrl =
    item?.mediaUrl && isAllowedMediaUrl(item.mediaUrl) ? item.mediaUrl : null;

  if (ocrUrl && mediaUrl) {
    const describeCall = await recordCall({
      service: "ocr",
      operation: "describe",
      status: "PENDING",
      correlationId: calc.id,
      calculationId: calc.id,
      requestMeta: { media: mediaUrlMeta(mediaUrl), hint: hint.slice(0, 120), chainId },
      finished: false,
    });
    const t0 = Date.now();
    try {
      const out = await callJson(
        `${ocrUrl}/v1/describe`,
        { mediaUrl, hint, mimeType: "image/jpeg", chainId },
        Number(process.env.OCR_TIMEOUT_MS || 20000)
      );
      if (!out.ok) {
        describeFailed = String(out.data.error || `ocr describe HTTP ${out.status}`);
        await completeCall(describeCall.id, {
          status: "FAILED",
          durationMs: Date.now() - t0,
          error: describeFailed.slice(0, 4000),
        });
      } else {
        visionDescription = String(out.data.description || out.data.text || "").trim() || null;
        await completeCall(describeCall.id, {
          status: "OK",
          durationMs: Date.now() - t0,
          responseMeta: { engine: out.data.engine, descriptionLen: visionDescription?.length || 0 },
        });
      }
    } catch (e) {
      describeFailed = e instanceof Error ? e.message : "ocr describe failed";
      await completeCall(describeCall.id, {
        status: classifyServiceError(e),
        durationMs: Date.now() - t0,
        error: describeFailed.slice(0, 4000),
      });
    } finally {
      const resetCall = await recordCall({
        service: "ocr",
        operation: "reset",
        status: "PENDING",
        correlationId: calc.id,
        calculationId: calc.id,
        requestMeta: { reason: "after_describe" },
        finished: false,
      });
      const tReset = Date.now();
      try {
        const reset = await callJson(`${ocrUrl}/v1/reset`, { chainId }, Number(process.env.OCR_RESET_TIMEOUT_MS || 8000));
        await completeCall(resetCall.id, {
          status: reset.ok || reset.data.skipped ? "OK" : "FAILED",
          durationMs: Date.now() - tReset,
          error: reset.ok || reset.data.skipped ? null : String(reset.data.error || "reset failed").slice(0, 4000),
          responseMeta: { engine: reset.data.engine, skipped: reset.data.skipped },
        });
      } catch (e) {
        await completeCall(resetCall.id, {
          status: classifyServiceError(e),
          durationMs: Date.now() - tReset,
          error: (e instanceof Error ? e.message : "ocr reset failed").slice(0, 4000),
        });
      }
    }
  }

  if (!llmUrl) {
    if (describeFailed) return { ok: false, visionDescription, error: describeFailed };
    return { ok: true, visionDescription, skipped: true, engine: "ocr-only" };
  }

  // C35a: skip provider classify when sync offline draft already confident.
  {
    const draftGate = (calc.aiDraft && typeof calc.aiDraft === "object" ? calc.aiDraft : {}) || {};
    const conf =
      typeof draftGate.confidence === "number" && Number.isFinite(draftGate.confidence)
        ? draftGate.confidence
        : typeof calc.confidence === "number"
          ? calc.confidence
          : 0;
    const skip = shouldSkipLlmClassify({
      engine: draftGate.engine,
      llmEnrich: draftGate.llmEnrich,
      confidence: conf,
    });
    if (skip.skip) {
      const nextDraft = {
        ...draftGate,
        llmEnrich: draftGate.llmEnrich || skip.offlineEngine,
        skipReason: skip.skipReason,
        llmEnrichPending: false,
        chainId,
        ...(visionDescription ? { visionDescription: String(visionDescription).slice(0, 2000) } : {}),
      };
      await prisma.calculation.update({
        where: { id: calc.id },
        data: { aiDraft: nextDraft },
      });
      return {
        ok: true,
        visionDescription,
        skipped: true,
        hsCode: draftGate.hsCode || calc.hsCode || null,
        engine: skip.offlineEngine,
      };
    }
  }

  const classifyCall = await recordCall({
    service: "llm",
    operation: "classify",
    status: "PENDING",
    correlationId: calc.id,
    calculationId: calc.id,
    requestMeta: { hasVision: Boolean(visionDescription), title: String(calc.title || "").slice(0, 80), chainId },
    finished: false,
  });
  const tLlm = Date.now();
  try {
    const out = await callJson(
      `${llmUrl}/v1/classify`,
      {
        title: calc.title,
        description: calc.description || item?.description,
        name: item?.name,
        country: calc.country,
        visionDescription,
        chainId,
      },
      Number(process.env.LLM_TIMEOUT_MS || 30000)
    );
    if (!out.ok) {
      const err = String(out.data.error || `llm classify HTTP ${out.status}`);
      await completeCall(classifyCall.id, {
        status: "FAILED",
        durationMs: Date.now() - tLlm,
        error: err.slice(0, 4000),
      });
      return { ok: false, visionDescription, error: err };
    }
    const hsCode = String(out.data.hsCode || "").trim() || null;
    await completeCall(classifyCall.id, {
      status: "OK",
      durationMs: Date.now() - tLlm,
      responseMeta: { engine: out.data.engine, hsCode, corpusMiss: out.data.corpusMiss },
    });
    if (hsCode) {
      const digits = String(hsCode).replace(/\D/g, "");
      await prisma.calculation.update({ where: { id: calc.id }, data: { hsCode } });
      if (item?.id) {
        await prisma.calculationItem.update({
          where: { id: item.id },
          data: { hsCodeAi: hsCode, tnvedCode: digits.length >= 4 ? digits : undefined },
        });
      }
    }
    return { ok: true, visionDescription, hsCode, engine: String(out.data.engine || "llm") };
  } catch (e) {
    const err = e instanceof Error ? e.message : "llm classify failed";
    await completeCall(classifyCall.id, {
      status: classifyServiceError(e),
      durationMs: Date.now() - tLlm,
      error: err.slice(0, 4000),
    });
    return { ok: false, visionDescription, error: err };
  }
}
