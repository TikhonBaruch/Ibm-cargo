/**
 * Mode A = in-process mesh (Vercel). Mode B = HTTP to capability containers.
 * Service URLs win when set (Compose).
 */

export type AiTransport = "service" | "mesh";

export function ocrServiceBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.OCR_SERVICE_URL || "").replace(/\/$/, "");
}

export function llmServiceBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.LLM_SERVICE_URL || "").replace(/\/$/, "");
}

export function visionTransport(env: NodeJS.ProcessEnv = process.env): AiTransport {
  return ocrServiceBaseUrl(env) ? "service" : "mesh";
}

export function classifyTransport(env: NodeJS.ProcessEnv = process.env): AiTransport {
  return llmServiceBaseUrl(env) ? "service" : "mesh";
}

export async function callServiceJson(
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}
