/**
 * Direct Qwen-VL + DeepSeek (OpenAI-compatible) for Vercel / Mode A
 * when OCR_SERVICE_URL / LLM_SERVICE_URL are unset.
 * Candidates from Prisma TnvedCode (no codes.jsonl mount on Hobby).
 *
 * Product name for ops/docs: «AI-контур» (Qwen→DeepSeek). Repo `/llm` = матрица HTTP-сервисов.
 */
import { readFile } from "fs/promises";
import type { PrismaClient } from "@prisma/client";
import {
  deepseekVisionConfigured,
  providerClassifyConfigured,
  qwenVisionConfigured,
  resolveClassifyChain,
  resolveOpenAiCompat,
  type OpenAiCompat,
} from "./openai-compat";
import {
  logAiDrain,
  softFailCodeForClassifyProfile,
  visionDescribeTimeoutMs,
} from "./ai-drain-retry";
import { isAllowedMediaUrl, localUploadFsPath } from "./media-url";
import { formatHsCode, normalizeHsCode, searchTnvedCodes } from "./tnved";
import type { ProductAttrs } from "./product-description";

type Db = PrismaClient;

export type ProviderClassifyInput = {
  title?: string | null;
  description?: string | null;
  name?: string | null;
  country?: string | null;
  visionDescription?: string | null;
};

export type ProviderClassifyResult = {
  hsCode: string;
  confidence: number;
  engine: string;
  disclaimer: string;
  candidates?: Array<{ hsCode: string; titleRu: string }>;
  /** Which chat profile produced the pick (deepseek / qwen / lookup). */
  profile?: string;
  /** True when all chat providers failed with transport errors (caller may requeue). */
  retriable?: boolean;
  /** Client-safe soft-fail codes when a chain link failed (test-mode notice). */
  softFails?: string[];
};

export type ProviderDescribeResult = {
  /** False when fetch or Qwen failed / empty description. */
  ok: boolean;
  engine?: string;
  description?: string;
  attrs?: ProductAttrs;
  /** Media GET diagnostics (no URL / no bytes). */
  fetch?: MediaFetchDiag;
  qwenHttpStatus?: number;
  error?: string;
};

export type MediaFetchErrorCode =
  | "http_error"
  | "not_image"
  | "too_large"
  | "too_small"
  | "timeout"
  | "network"
  | "no_key"
  | "url_blocked";

export type MediaFetchDiag = {
  ok: boolean;
  status?: number;
  mime?: string;
  bytes?: number;
  errorCode?: MediaFetchErrorCode;
  error?: string;
};

/** Synonym → HS prefix (prefer heading/subheading over whole chapter).
 * Order = priority: specific product before broad apparel. */
export const TNVED_PREFIX_HINTS: Array<{ test: RegExp; prefix: string }> = [
  { test: /футболк|t-?shirts?|tee[\s-]?shirt|майк[аиуе]?/i, prefix: "6109" },
  { test: /кроссов|sneakers?|кед[аы]|спортивн\w*\s+обув|обувь\s+для\s+(тенниса|бега|баскетбола)/i, prefix: "6404" },
  { test: /обув|ботин|туфл|\bshoes?\b/i, prefix: "64" },
  { test: /ноутбук|laptop|notebook|macbook|портативн\w*\s+вычисл|компьютер/i, prefix: "847130" },
  { test: /смартфон|smartphone|iphone/i, prefix: "851713" },
  { test: /телефон|android|сотов/i, prefix: "8517" },
  { test: /светодиод|\bled\b|ламп[аыуе].*(led|светодиод)|(led|светодиод).*ламп|цоколь\s*e27/i, prefix: "853952" },
  { test: /ламп[аыуе]|bulb|освещен/i, prefix: "8539" },
  { test: /мебел|стул|стол|sofa/i, prefix: "9403" },
  // Broad apparel last — «верх текстиль» у кроссовок не должен перебивать обувь
  { test: /трикотаж|knitwear|хлопок|cotton|apparel|одежд/i, prefix: "61" },
];

/** Colloquial query → official titleRu / code boosts for leaf ranking. */
const TITLE_SYNONYMS: Array<{ test: RegExp; titleBoost: RegExp; codeBoost?: RegExp }> = [
  {
    test: /кроссов|sneaker|кед|спортивн|теннис|баскетбол|гимнаст|тренировоч/i,
    titleBoost: /спортивн|теннис|баскетбол|гимнаст|тренировоч/i,
    codeBoost: /^640411/,
  },
  {
    test: /футболк|t-?shirt|майк|хлопк|cotton/i,
    titleBoost: /хлопчат|хлопк/i,
    codeBoost: /^610910/,
  },
  {
    test: /ноутбук|laptop|notebook|macbook|портативн/i,
    titleBoost: /портативн|клавиатур|диспле/i,
    codeBoost: /^847130/,
  },
  {
    test: /смартфон|smartphone|iphone/i,
    titleBoost: /смартфон/i,
    codeBoost: /^851713/,
  },
  {
    test: /светодиод|\bled\b|e27/i,
    titleBoost: /светодиод|\bled\b/i,
    codeBoost: /^853952/,
  },
];

/** Tokens that pollute lexical search (false friends / noise). */
const STOP_TOKENS = new Set([
  "для",
  "без",
  "или",
  "новая",
  "новый",
  "новые",
  "упаковке",
  "упаковка",
  "повседневной",
  "повседневная",
  "повседневные",
  // «носки» = socks AND genitive of «носка» (wear) — never search alone
  "носки",
  "носка",
  "носке",
  "маркер",
  "прогона",
  "артикул",
  "женщин",
  "женская",
  "мужская",
  "мужской",
  "women",
  "women's",
  "mens",
  "men's",
  "short",
  "sleeve",
  "crew",
  "neck",
]);

type Cand = { code: string; hsCode: string; titleRu: string };

function classifyText(body: ProviderClassifyInput): string {
  return [body.title, body.description, body.name, body.visionDescription]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function resolveTnvedPrefixHint(text: string): string | null {
  const hit = TNVED_PREFIX_HINTS.find((h) => h.test.test(text));
  return hit?.prefix ?? null;
}

/** Rank a leaf against query text (higher = better). Used by loadByPrefix + unit tests. */
export function scoreTnvedCandidate(
  text: string,
  cand: { code: string; titleRu: string },
  prefix?: string | null
): number {
  const title = cand.titleRu.toLowerCase();
  const tokens = tokenizeForTnvedSearch(text);
  let score = 0;
  for (const t of tokens) {
    if (title.includes(t)) score += 2;
  }
  for (const syn of TITLE_SYNONYMS) {
    if (!syn.test.test(text)) continue;
    if (syn.titleBoost.test(title)) score += 10;
    if (syn.codeBoost?.test(cand.code)) score += 14;
  }
  // Longer shared prefix with hint = closer leaf
  if (prefix && cand.code.startsWith(prefix)) {
    score += Math.min(prefix.length, 8);
  }
  // Prefer full 10-digit leaves already filtered
  if (cand.code.length >= 10) score += 1;

  if (prefix?.startsWith("64") || /^64/.test(cand.code)) {
    const textileQuery = /текстил|textile|кроссов|sneaker|кед/i.test(text);
    if (textileQuery && /верхом из резины|верх из резины/i.test(title)) score -= 6;
    if (textileQuery && cand.code.startsWith("6401")) score -= 8; // protective toe / waterproof
  }
  return score;
}

export function tokenizeForTnvedSearch(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .map((t) => t.trim())
        .filter((t) => t.length >= 4)
        .filter((t) => !STOP_TOKENS.has(t))
        .filter((t) => !/^e2e/i.test(t))
        .filter((t) => !/^\d+$/.test(t))
        .slice(0, 8)
    )
  );
}

function toCand(r: { code: string; codeDisplay?: string | null; titleRu: string }): Cand {
  return {
    code: r.code,
    hsCode: r.codeDisplay || formatHsCode(r.code) || r.code,
    titleRu: r.titleRu,
  };
}

function dedupeCands(rows: Cand[]): Cand[] {
  const seen = new Set<string>();
  const out: Cand[] = [];
  for (const c of rows) {
    if (c.code.length < 4 || seen.has(c.code)) continue;
    seen.add(c.code);
    out.push(c);
  }
  return out;
}

async function chatJson(
  compat: ReturnType<typeof resolveOpenAiCompat>,
  system: string,
  user: string,
  model: string,
  timeoutMs: number
): Promise<Record<string, unknown>> {
  const res = await fetch(`${compat.base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${compat.key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`${compat.profile} ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content) as Record<string, unknown>;
}

async function loadByPrefix(db: Db, prefix: string, text: string, take = 12): Promise<Cand[]> {
  // Narrow prefixes (6–10 digits) need fewer rows; chapter (2) needs a wider pool then rank.
  const pool = prefix.length <= 2 ? 80 : prefix.length <= 4 ? 48 : 24;
  const rows = await db.tnvedCode.findMany({
    where: { isActive: true, isLeaf: true, code: { startsWith: prefix } },
    take: Math.max(take * 4, pool),
    orderBy: { code: "asc" },
  });
  const scored = rows
    .map(toCand)
    .map((c) => ({ c, score: scoreTnvedCandidate(text, c, prefix) }))
    .sort((a, b) => b.score - a.score || a.c.code.localeCompare(b.c.code));
  const top = scored.filter((s) => s.score > 0).slice(0, take).map((s) => s.c);
  if (top.length) return dedupeCands(top);
  return dedupeCands(rows.slice(0, take).map(toCand));
}

async function loadLexical(db: Db, q: string, leafOnly: boolean, prefix?: string | null): Promise<Cand[]> {
  const rows = await searchTnvedCodes(db, { q: q.slice(0, 120), limit: 12, leafOnly });
  let cands = dedupeCands(rows.map(toCand));
  if (prefix) {
    cands = cands.filter((c) => c.code.startsWith(prefix));
  }
  return cands;
}

/** Lexical candidates from prod/local TnvedCode, then provider pick among them. */
export async function classifyWithProvider(
  db: Db,
  body: ProviderClassifyInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<ProviderClassifyResult | null> {
  return classifyWithProviderChain(db, body, env);
}

/**
 * Try LLM_CLASSIFY_CHAIN (DeepSeek → Qwen …); lexical only after all chat providers fail.
 * Transport failures set `retriable` when no lexical candidates either.
 */
export async function classifyWithProviderChain(
  db: Db,
  body: ProviderClassifyInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<ProviderClassifyResult | null> {
  const chain = resolveClassifyChain(env);
  if (!chain.length) return null;
  const text = classifyText(body);
  if (!text) return null;

  const timeoutMs = Number(env.LLM_TIMEOUT_MS || 120000);
  const tokens = tokenizeForTnvedSearch(text);
  const prefixHint = resolveTnvedPrefixHint(text);

  let candidates: Cand[] = [];
  if (prefixHint) {
    candidates = await loadByPrefix(db, prefixHint, text);
  }
  if (!candidates.length) {
    candidates = await loadLexical(db, text, true, prefixHint);
  }
  if (!candidates.length) {
    for (const tok of tokens) {
      candidates = await loadLexical(db, tok, true, prefixHint);
      if (candidates.length) break;
    }
  }
  if (!candidates.length) {
    candidates = await loadLexical(db, text, false, prefixHint);
  }
  if (!candidates.length && tokens[0]) {
    candidates = await loadLexical(db, tokens[0], false, prefixHint);
  }
  if (!candidates.length && !prefixHint) {
    candidates = await loadLexical(db, text, true, null);
  }

  if (!candidates.length) {
    logAiDrain({ phase: "classify-no-candidates", extra: { prefixHint } });
    return null;
  }

  const lexicalFallback = (reason: string): ProviderClassifyResult => ({
    hsCode: candidates[0].hsCode,
    confidence: 0.58,
    engine: "llm-lookup-v1",
    profile: "lookup",
    disclaimer: `Лексический подбор по справочнику ТН ВЭД (${reason}). Рекомендация, не финальный код.`,
    candidates: candidates.map((c) => ({ hsCode: c.hsCode, titleRu: c.titleRu })),
  });

  const system =
    'Ты классификатор товаров по ТН ВЭД ЕАЭС. Выбери один наиболее точный 10-значный код ТОЛЬКО из списка candidates (предпочтительно полный лист, не более общий). Если ни один код не подходит — верни hsCode:null. Ответь строго JSON: {"hsCode":"<точный hsCode из списка или null>","confidence":0-1,"disclaimer":"<кратко по-русски>"}. Не придумывай код вне списка. Не подставляй «ближайший» нерелевантный код.';
  const user = JSON.stringify({
    title: body.title || "",
    description: body.description || "",
    visionDescription: body.visionDescription || "",
    country: body.country || "",
    candidates: candidates.map((c) => ({ hsCode: c.hsCode, titleRu: c.titleRu })),
  });

  const allowed = new Set(candidates.map((c) => c.code));
  const transportErrors: string[] = [];
  const failedProfiles: string[] = [];

  for (const compat of chain) {
    try {
      logAiDrain({ phase: "classify-try", provider: compat.profile });
      const parsed = await chatJson(compat, system, user, compat.classifyModel, timeoutMs);
      const picked = pickFromParsed(parsed, candidates, allowed, compat);
      if (picked) {
        logAiDrain({
          phase: "classify-ok",
          provider: compat.profile,
          hsCode: picked.hsCode,
          engine: picked.engine,
        });
        const softFails = failedProfiles.map(softFailCodeForClassifyProfile);
        return softFails.length ? { ...picked, softFails } : picked;
      }
      logAiDrain({ phase: "classify-null-hs", provider: compat.profile });
      failedProfiles.push(compat.profile);
      // Model refused — try next provider before lexical
    } catch (e) {
      const msg = e instanceof Error ? e.message : "classify failed";
      transportErrors.push(`${compat.profile}: ${msg.slice(0, 160)}`);
      failedProfiles.push(compat.profile);
      logAiDrain({ phase: "classify-transport-fail", provider: compat.profile, error: msg.slice(0, 200) });
    }
  }

  if (prefixHint || candidates.length) {
    const lex = lexicalFallback(
      transportErrors.length
        ? `провайдеры недоступны: ${transportErrors.join("; ")}`
        : "модели не выбрали код"
    );
    logAiDrain({ phase: "classify-lexical", hsCode: lex.hsCode, engine: lex.engine });
    const softFails =
      failedProfiles.length > 0
        ? failedProfiles.map(softFailCodeForClassifyProfile)
        : [softFailCodeForClassifyProfile("chain")];
    // Transport failures but lexical ok → not retriable for job (client has a chapter code).
    return { ...lex, softFails };
  }

  logAiDrain({
    phase: "classify-all-failed",
    error: transportErrors.join("; ") || "no result",
    retriable: transportErrors.length > 0,
  });
  return null;
}

function pickFromParsed(
  parsed: Record<string, unknown>,
  candidates: Cand[],
  allowed: Set<string>,
  compat: OpenAiCompat
): ProviderClassifyResult | null {
  const rawHs = parsed.hsCode;
  if (rawHs === null || rawHs === undefined || String(rawHs).trim() === "" || String(rawHs).toLowerCase() === "null") {
    return null;
  }

  let dig = normalizeHsCode(String(rawHs)) || "";
  if (!allowed.has(dig)) {
    const match = candidates.find((c) => c.hsCode === String(rawHs).trim());
    if (!match) return null;
    dig = match.code;
  }

  const disclaimer = String(parsed.disclaimer || "");
  if (/ни один|не подход|none of|no code|не относ/i.test(disclaimer) && Number(parsed.confidence) < 0.4) {
    return null;
  }

  const chosen = candidates.find((c) => c.code === dig);
  if (!chosen) return null;

  return {
    hsCode: chosen.hsCode,
    confidence: Math.min(0.95, Math.max(0.5, Number(parsed.confidence) || 0.75)),
    engine: "llm-openai-v1",
    profile: compat.profile,
    disclaimer:
      disclaimer ||
      "Выбор модели среди кандидатов справочника ТН ВЭД — рекомендация, не финальный код.",
    candidates: candidates.map((c) => ({ hsCode: c.hsCode, titleRu: c.titleRu })),
  };
}

export type MediaFetchResult = MediaFetchDiag & {
  b64?: string;
  mime?: string;
};

function finalizeImageBuffer(
  buf: Buffer,
  mime: string,
  status?: number
): MediaFetchResult {
  const bytes = buf.length;
  if (!mime.startsWith("image/")) {
    return {
      ok: false,
      status,
      mime,
      bytes,
      errorCode: "not_image",
      error: `fetch not image: ${mime || "missing content-type"}`.slice(0, 200),
    };
  }
  if (bytes < 32) {
    return {
      ok: false,
      status,
      mime,
      bytes,
      errorCode: "too_small",
      error: `image too small (${bytes}B)`,
    };
  }
  if (bytes > 8_000_000) {
    return {
      ok: false,
      status,
      mime,
      bytes,
      errorCode: "too_large",
      error: `image too large (${bytes}B)`,
    };
  }
  return { ok: true, status, mime, bytes, b64: buf.toString("base64") };
}

function mimeFromLocalName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

/**
 * Download media for vision. Never returns image bytes in logs — caller strips b64.
 * Only allowlisted mediaUrl (S3 /uploads/ved + MEDIA_URL_ALLOWED_PREFIXES); local paths read from FS.
 * Exported for unit tests.
 */
export async function fetchMediaAsBase64(
  mediaUrl: string,
  timeoutMs: number,
  env: NodeJS.ProcessEnv = process.env
): Promise<MediaFetchResult> {
  if (!isAllowedMediaUrl(mediaUrl, env)) {
    return {
      ok: false,
      errorCode: "url_blocked",
      error: "mediaUrl not allowlisted",
    };
  }

  const fsPath = localUploadFsPath(mediaUrl);
  if (fsPath) {
    try {
      const buf = await readFile(fsPath);
      const mime = mimeFromLocalName(fsPath);
      return finalizeImageBuffer(buf, mime, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "read failed";
      return {
        ok: false,
        errorCode: "network",
        error: msg.slice(0, 200),
      };
    }
  }

  try {
    const res = await fetch(mediaUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "error",
    });
    const mime = (res.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();
    const buf = Buffer.from(await res.arrayBuffer());
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        mime,
        bytes: buf.length,
        errorCode: "http_error",
        error: `fetch HTTP ${res.status} ${mime || "unknown"}`.slice(0, 200),
      };
    }
    return finalizeImageBuffer(buf, mime, res.status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    const timeout = /timeout|aborted|AbortError/i.test(msg);
    const redirect = /redirect/i.test(msg);
    return {
      ok: false,
      errorCode: redirect ? "url_blocked" : timeout ? "timeout" : "network",
      error: msg.slice(0, 200),
    };
  }
}

function fetchDiagOnly(r: MediaFetchResult): MediaFetchDiag {
  return {
    ok: r.ok,
    status: r.status,
    mime: r.mime,
    bytes: r.bytes,
    errorCode: r.errorCode,
    error: r.error,
  };
}

/** Qwen-VL describe from public mediaUrl (S3). Fail-open with structured diagnostics. */
export async function describeWithProviderQwen(
  opts: { mediaUrl: string; hint?: string; calculationId?: string },
  env: NodeJS.ProcessEnv = process.env
): Promise<ProviderDescribeResult> {
  if (!qwenVisionConfigured(env)) {
    return {
      ok: false,
      fetch: { ok: false, errorCode: "no_key", error: "QWEN_API_KEY missing" },
      error: "QWEN_API_KEY missing",
    };
  }
  const key = String(env.QWEN_API_KEY || "").trim();
  const base = String(env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(
    /\/$/,
    ""
  );
  const model = String(env.QWEN_VISION_MODEL || "qwen-vl-plus").trim();
  const timeoutMs = visionDescribeTimeoutMs(env);

  const media = await fetchMediaAsBase64(opts.mediaUrl, timeoutMs);
  const fetchDiag = fetchDiagOnly(media);
  logAiDrain({
    phase: "vision-fetch",
    calculationId: opts.calculationId,
    ok: fetchDiag.ok,
    error: fetchDiag.error,
    extra: {
      status: fetchDiag.status,
      mime: fetchDiag.mime,
      bytes: fetchDiag.bytes,
      errorCode: fetchDiag.errorCode,
    },
  });
  if (!media.ok || !media.b64 || !media.mime) {
    return {
      ok: false,
      fetch: fetchDiag,
      error: fetchDiag.error || "media fetch failed",
    };
  }

  const prompt =
    'Опиши товар на изображении для классификации ТН ВЭД. Ответь JSON: {"description":"<по-русски 1-4 предложения>","attrs":{"material":"","composition":"","purpose":""}}. Не выдумывай код ТН ВЭД.';

  logAiDrain({
    phase: "vision-qwen-request",
    calculationId: opts.calculationId,
    extra: { model, mime: media.mime, bytes: media.bytes },
  });

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `${prompt} Hint: ${opts.hint || ""}`.trim() },
              {
                type: "image_url",
                image_url: { url: `data:${media.mime};base64,${media.b64}` },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const errBody = (await res.text().catch(() => "")).slice(0, 180);
      const error = `qwen HTTP ${res.status}${errBody ? `: ${errBody}` : ""}`.slice(0, 300);
      logAiDrain({
        phase: "vision-qwen-fail",
        calculationId: opts.calculationId,
        ok: false,
        error,
        extra: { qwenHttpStatus: res.status },
      });
      return { ok: false, fetch: fetchDiag, qwenHttpStatus: res.status, error, engine: "qwen-vl-v1" };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}") as {
      description?: string;
      text?: string;
      attrs?: ProductAttrs;
    };
    // Stateless reset (best-effort, ignore errors)
    try {
      await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: 'Reset context. Ignore any previous image. Reply JSON {"ok":true}.',
            },
          ],
        }),
        signal: AbortSignal.timeout(Number(env.OCR_RESET_TIMEOUT_MS || 8000)),
      });
    } catch {
      /* fail-open */
    }
    const description = String(parsed.description || parsed.text || "").trim();
    if (!description) {
      logAiDrain({
        phase: "vision-qwen-fail",
        calculationId: opts.calculationId,
        ok: false,
        error: "qwen describe empty",
        extra: { qwenHttpStatus: res.status },
      });
      return {
        ok: false,
        fetch: fetchDiag,
        qwenHttpStatus: res.status,
        error: "qwen describe empty",
        engine: "qwen-vl-v1",
      };
    }
    logAiDrain({
      phase: "vision-qwen-ok",
      calculationId: opts.calculationId,
      ok: true,
      engine: "qwen-vl-v1",
      extra: { descriptionLen: description.length, qwenHttpStatus: res.status },
    });
    return {
      ok: true,
      engine: "qwen-vl-v1",
      description,
      attrs: parsed.attrs && typeof parsed.attrs === "object" ? parsed.attrs : undefined,
      fetch: fetchDiag,
      qwenHttpStatus: res.status,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "qwen describe failed";
    logAiDrain({
      phase: "vision-qwen-fail",
      calculationId: opts.calculationId,
      ok: false,
      error: msg.slice(0, 200),
    });
    return { ok: false, fetch: fetchDiag, error: msg.slice(0, 300), engine: "qwen-vl-v1" };
  }
}

/** DeepSeek vision describe (chain 3). OpenAI-compatible image_url; fail-open. */
export async function describeWithProviderDeepseek(
  opts: { mediaUrl: string; hint?: string; calculationId?: string },
  env: NodeJS.ProcessEnv = process.env
): Promise<ProviderDescribeResult> {
  if (!deepseekVisionConfigured(env)) {
    return {
      ok: false,
      fetch: { ok: false, errorCode: "no_key", error: "DEEPSEEK_API_KEY missing" },
      error: "DEEPSEEK_API_KEY missing",
    };
  }
  const key = String(env.DEEPSEEK_API_KEY || "").trim();
  const base = String(env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const model = String(
    env.DEEPSEEK_VISION_MODEL || "deepseek-v4-flash-vision-exp"
  ).trim();
  const timeoutMs = visionDescribeTimeoutMs(env);

  const media = await fetchMediaAsBase64(opts.mediaUrl, timeoutMs);
  const fetchDiag = fetchDiagOnly(media);
  logAiDrain({
    phase: "vision-fetch",
    calculationId: opts.calculationId,
    ok: fetchDiag.ok,
    error: fetchDiag.error,
    extra: {
      status: fetchDiag.status,
      mime: fetchDiag.mime,
      bytes: fetchDiag.bytes,
      errorCode: fetchDiag.errorCode,
      provider: "deepseek",
    },
  });
  if (!media.ok || !media.b64 || !media.mime) {
    return {
      ok: false,
      fetch: fetchDiag,
      error: fetchDiag.error || "media fetch failed",
    };
  }

  const prompt =
    'Опиши товар на изображении для классификации ТН ВЭД. Ответь JSON: {"description":"<по-русски 1-4 предложения>","attrs":{"material":"","composition":"","purpose":""}}. Не выдумывай код ТН ВЭД.';

  logAiDrain({
    phase: "vision-deepseek-request",
    calculationId: opts.calculationId,
    extra: { model, mime: media.mime, bytes: media.bytes },
  });

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `${prompt} Hint: ${opts.hint || ""}`.trim() },
              {
                type: "image_url",
                image_url: { url: `data:${media.mime};base64,${media.b64}` },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const errBody = (await res.text().catch(() => "")).slice(0, 180);
      const error = `deepseek-vision HTTP ${res.status}${errBody ? `: ${errBody}` : ""}`.slice(
        0,
        300
      );
      logAiDrain({
        phase: "vision-deepseek-fail",
        calculationId: opts.calculationId,
        ok: false,
        error,
        extra: { httpStatus: res.status },
      });
      return {
        ok: false,
        fetch: fetchDiag,
        qwenHttpStatus: res.status,
        error,
        engine: "deepseek-vision-v1",
      };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawContent = String(data.choices?.[0]?.message?.content || "").trim();
    let description = "";
    let attrs: ProductAttrs | undefined;
    try {
      const parsed = JSON.parse(rawContent) as {
        description?: string;
        text?: string;
        attrs?: ProductAttrs;
      };
      description = String(parsed.description || parsed.text || "").trim();
      if (parsed.attrs && typeof parsed.attrs === "object") attrs = parsed.attrs;
    } catch {
      description = rawContent.replace(/^```json\s*|\s*```$/g, "").trim();
    }
    if (!description) {
      logAiDrain({
        phase: "vision-deepseek-fail",
        calculationId: opts.calculationId,
        ok: false,
        error: "deepseek describe empty",
        extra: { httpStatus: res.status },
      });
      return {
        ok: false,
        fetch: fetchDiag,
        qwenHttpStatus: res.status,
        error: "deepseek describe empty",
        engine: "deepseek-vision-v1",
      };
    }
    logAiDrain({
      phase: "vision-deepseek-ok",
      calculationId: opts.calculationId,
      ok: true,
      engine: "deepseek-vision-v1",
      extra: { descriptionLen: description.length, httpStatus: res.status },
    });
    return {
      ok: true,
      engine: "deepseek-vision-v1",
      description,
      attrs,
      fetch: fetchDiag,
      qwenHttpStatus: res.status,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "deepseek describe failed";
    logAiDrain({
      phase: "vision-deepseek-fail",
      calculationId: opts.calculationId,
      ok: false,
      error: msg.slice(0, 200),
    });
    return { ok: false, fetch: fetchDiag, error: msg.slice(0, 300), engine: "deepseek-vision-v1" };
  }
}
