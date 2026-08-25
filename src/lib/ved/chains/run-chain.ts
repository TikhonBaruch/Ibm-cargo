/**
 * Orch facade: AI_CHAIN_ID + transport (Mode A mesh | Mode B OCR/LLM HTTP).
 * Pipeline should call describeForChain / classifyForChain only — not raw service URLs.
 */
import { readFile } from "node:fs/promises";
import type { PrismaClient } from "@prisma/client";
import { LLM_SOFT_FAIL, classifyTimeoutMs, visionDescribeTimeoutMs } from "../ai-drain-retry";
import {
  deepseekVisionConfigured,
  providerClassifyConfigured,
  qwenVisionConfigured,
} from "../openai-compat";
import {
  classifyWithProvider,
  describeWithProviderDeepseek,
  describeWithProviderQwen,
  type ProviderClassifyInput,
  type ProviderClassifyResult,
  type ProviderDescribeResult,
} from "../provider-mesh";
import type { ProductAttrs } from "../product-description";
import { localUploadFsPath } from "../media-url";
import {
  aiChainMeta,
  classifyEnvForChain,
  resolveAiChainId,
  type AiChainId,
} from "./registry";
import {
  callServiceJson,
  classifyTransport,
  llmServiceBaseUrl,
  ocrServiceBaseUrl,
  visionTransport,
  type AiTransport,
} from "./transport";
import type { EnvBag } from "../../env-bag";

export type ChainVisionMode = "direct-qwen" | "direct-deepseek" | "ocr-service" | "none";

export type ChainDescribeResult = ProviderDescribeResult & {
  transport: AiTransport;
  mode: ChainVisionMode | string;
};

export type ChainClassifyResult =
  | {
      ok: true;
      transport: AiTransport;
      hsCode: string | null;
      engine: string;
      confidence?: number;
      disclaimer?: string;
      corpusMiss?: unknown;
      softFails?: string[];
      profile?: string;
      retriable?: boolean;
    }
  | {
      ok: false;
      transport: AiTransport;
      error: string;
      retriable: boolean;
      /** Mesh terminal miss — settle soft-fail, do not requeue. */
      softMiss?: boolean;
    };

export function visionConfiguredForChain(
  chainId: AiChainId = resolveAiChainId(),
  env: EnvBag = process.env
): boolean {
  if (visionTransport(env) === "service") return true;
  const meta = aiChainMeta(chainId);
  if (meta.vision === "deepseek") return deepseekVisionConfigured(env);
  if (meta.vision === "qwen") return qwenVisionConfigured(env);
  if (meta.vision === "nvidia") {
    // Legacy: reuse OpenAI-compat key on NIM (same as qwen path until dedicated adapter).
    return qwenVisionConfigured(env) || deepseekVisionConfigured(env);
  }
  return false;
}

export function classifyConfiguredForChain(
  chainId: AiChainId = resolveAiChainId(),
  env: EnvBag = process.env
): boolean {
  if (classifyTransport(env) === "service") return true;
  return providerClassifyConfigured(classifyEnvForChain(chainId, env));
}

export function visionModeForChain(
  chainId: AiChainId,
  env: EnvBag = process.env
): ChainVisionMode {
  if (visionTransport(env) === "service") return "ocr-service";
  const v = aiChainMeta(chainId).vision;
  if (v === "deepseek") return "direct-deepseek";
  if (v === "qwen" || v === "nvidia") return "direct-qwen";
  return "none";
}

export function visionSoftFailForChain(chainId: AiChainId): string {
  return aiChainMeta(chainId).vision === "deepseek"
    ? LLM_SOFT_FAIL.VISION_DEEPSEEK
    : LLM_SOFT_FAIL.VISION_QWEN;
}

export function visionPhasesForChain(chainId: AiChainId): {
  fail: string;
  ok: string;
} {
  const deep = aiChainMeta(chainId).vision === "deepseek";
  return {
    fail: deep ? "vision-deepseek-fail" : "vision-qwen-fail",
    ok: deep ? "vision-deepseek-ok" : "vision-qwen-ok",
  };
}

async function ocrDescribeBody(
  opts: { mediaUrl: string; hint?: string },
  chainId: AiChainId
): Promise<Record<string, unknown>> {
  const base: Record<string, unknown> = {
    hint: opts.hint,
    mimeType: "image/jpeg",
    chainId,
  };
  // Mode B OCR runs in Docker and cannot fetch Next-relative `/uploads/ved/…`.
  // Inline local bytes as imageBase64 (same envelope as mesh FS read).
  const fsPath = localUploadFsPath(opts.mediaUrl);
  if (fsPath) {
    const buf = await readFile(fsPath);
    const ext = fsPath.split(".").pop()?.toLowerCase();
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/jpeg";
    return {
      ...base,
      mimeType: mime,
      imageBase64: buf.toString("base64"),
    };
  }
  return { ...base, mediaUrl: opts.mediaUrl };
}

export async function describeForChain(
  chainId: AiChainId,
  opts: { mediaUrl: string; hint?: string; calculationId?: string },
  env: EnvBag = process.env
): Promise<ChainDescribeResult> {
  const mode = visionModeForChain(chainId, env);
  const ocrUrl = ocrServiceBaseUrl(env);
  if (ocrUrl) {
    const timeoutMs = visionDescribeTimeoutMs(env);
    try {
      const body = await ocrDescribeBody(opts, chainId);
      const out = await callServiceJson(`${ocrUrl}/v1/describe`, body, timeoutMs);
      if (!out.ok) {
        return {
          ok: false,
          transport: "service",
          mode,
          error: String(out.data.error || `ocr describe HTTP ${out.status}`),
          qwenHttpStatus: out.status,
          engine: out.data.engine != null ? String(out.data.engine) : undefined,
        };
      }
      const description = String(out.data.description || out.data.text || "").trim() || undefined;
      if (!description) {
        return {
          ok: false,
          transport: "service",
          mode,
          error: "ocr describe empty",
          engine: out.data.engine != null ? String(out.data.engine) : undefined,
        };
      }
      return {
        ok: true,
        transport: "service",
        mode,
        description,
        engine: String(out.data.engine || "ocr"),
        attrs: out.data.attrs as ProductAttrs | undefined,
      };
    } catch (e) {
      return {
        ok: false,
        transport: "service",
        mode,
        error: e instanceof Error ? e.message : "ocr describe failed",
      };
    }
  }

  const mesh: ProviderDescribeResult =
    aiChainMeta(chainId).vision === "deepseek"
      ? await describeWithProviderDeepseek(opts, env)
      : await describeWithProviderQwen(opts, env);
  return { ...mesh, transport: "mesh", mode };
}

/** Best-effort session reset after Mode B describe (Qwen cookie). Mesh = no-op. */
export async function resetOcrSessionForChain(
  env: EnvBag = process.env
): Promise<{ ok: boolean; skipped?: boolean; status: number; data: Record<string, unknown> }> {
  const ocrUrl = ocrServiceBaseUrl(env);
  if (!ocrUrl) {
    return { ok: true, skipped: true, status: 200, data: { skipped: true } };
  }
  const timeoutMs = Number(env.OCR_RESET_TIMEOUT_MS || 8000);
  try {
    const out = await callServiceJson(`${ocrUrl}/v1/reset`, {}, timeoutMs);
    return { ...out, skipped: Boolean(out.data.skipped) };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: { error: e instanceof Error ? e.message : "ocr reset failed" },
    };
  }
}

export async function classifyForChain(
  db: PrismaClient,
  chainId: AiChainId,
  body: ProviderClassifyInput,
  env: EnvBag = process.env
): Promise<ChainClassifyResult> {
  const llmUrl = llmServiceBaseUrl(env);
  if (llmUrl) {
    try {
      const out = await callServiceJson(
        `${llmUrl}/v1/classify`,
        {
          title: body.title,
          description: body.description,
          name: body.name,
          country: body.country,
          visionDescription: body.visionDescription,
          chainId,
        },
        classifyTimeoutMs(env)
      );
      if (!out.ok) {
        const status = out.status;
        return {
          ok: false,
          transport: "service",
          error: String(out.data.error || `llm classify HTTP ${status}`),
          retriable: status >= 500 || status === 429 || status === 408,
        };
      }
      return {
        ok: true,
        transport: "service",
        hsCode: String(out.data.hsCode || "").trim() || null,
        engine: String(out.data.engine || "llm"),
        confidence: typeof out.data.confidence === "number" ? out.data.confidence : undefined,
        disclaimer: out.data.disclaimer != null ? String(out.data.disclaimer) : undefined,
        corpusMiss: out.data.corpusMiss,
      };
    } catch (e) {
      return {
        ok: false,
        transport: "service",
        error: e instanceof Error ? e.message : "llm classify failed",
        retriable: true,
      };
    }
  }

  const classified: ProviderClassifyResult | null = await classifyWithProvider(
    db,
    body,
    classifyEnvForChain(chainId, env)
  );
  if (!classified) {
    return {
      ok: false,
      transport: "mesh",
      error: "provider classify miss (no TnvedCode candidates or no key)",
      retriable: false,
      softMiss: true,
    };
  }
  return {
    ok: true,
    transport: "mesh",
    hsCode: classified.hsCode,
    engine: classified.engine,
    confidence: classified.confidence,
    disclaimer: classified.disclaimer,
    softFails: classified.softFails,
    profile: classified.profile,
    retriable: classified.retriable,
  };
}
