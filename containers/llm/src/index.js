/**
 * LLM Classification + Duty. Envelope: contracts/d-classification.llm.json
 * Corpus lexical top-K → optional OpenAI-compatible pick among candidates → duty from leaf.
 * Fail-open: openai errors → lexical top-1 / stub.
 */
import http from "node:http";
import { DEFAULT_IMPORT_VAT_PERCENT, customsOperationsFeeFromUsd } from "./customs-fees.js";
import {
  loadTnvedLeaves,
  lexicalCandidates,
  getLeaf,
  formatHs,
  digitsHs,
  TOP_K,
} from "./tnved-lookup.js";
import { resolveOpenAiCompat } from "./openai-compat.js";

const port = Number(process.env.PORT || 4500);
const compat = resolveOpenAiCompat(process.env);
const openaiKey = compat.key;
const openaiBase = compat.base;
const classifyModel = compat.classifyModel;
const dutyModel = process.env.LLM_DUTY_MODEL || classifyModel;
const providerMode = openaiKey ? "openai" : "stub";

const corpus = loadTnvedLeaves();

const RULES = [
  { test: /ноутбук|laptop|notebook|macbook|компьютер|пк\b|сервер/i, hsCode: "8471 30 000 0", duty: 0, feeRub: 12000, confidence: 0.9 },
  { test: /телефон|смартфон|iphone|android|mobile phone/i, hsCode: "8517 13 000 0", duty: 0, feeRub: 10000, confidence: 0.86 },
  { test: /ткан|одежд|текстил|apparel|cotton|хлопок|куртк/i, hsCode: "6203 42 310 0", duty: 10, feeRub: 8000, confidence: 0.78 },
  { test: /автозапчаст|двигател|шина|автомоб|vehicle|engine/i, hsCode: "8708 99 970 9", duty: 5, feeRub: 15000, confidence: 0.74 },
  { test: /хими|реактив|краск|лак|solvent|chemical/i, hsCode: "3208 90 910 0", duty: 5, feeRub: 18000, confidence: 0.7 },
  { test: /пищев|продукт|еда|coffee|чай|chocolate|шоколад/i, hsCode: "1806 90 190 0", duty: 10, feeRub: 14000, confidence: 0.72 },
  { test: /мебел|стул|стол|furniture|sofa/i, hsCode: "9403 60 900 0", duty: 0, feeRub: 11000, confidence: 0.76 },
];

const DEFAULT = { hsCode: "8471 30 000 0", duty: 7, feeRub: 15000, confidence: 0.58 };

function classifyText(body = {}) {
  return `${body.title || ""} ${body.description || ""} ${body.name || ""} ${body.visionDescription || ""}`.trim();
}

function stubClassify(body = {}) {
  const text = classifyText(body);
  const rule = RULES.find((r) => r.test.test(text)) || DEFAULT;
  const countryBoost = body.country && /китай|china|cn\b/i.test(body.country) ? 0.02 : 0;
  return {
    hsCode: rule.hsCode,
    confidence: Math.min(0.95, rule.confidence + countryBoost),
    engine: "llm-stub-v0",
    disclaimer: "Черновик классификации (llm-stub-v0). Для модели задайте OPENAI_API_KEY.",
    inputPreview: text.slice(0, 200),
    corpusMiss: true,
  };
}

function stubDuty(body = {}) {
  const hs = String(body.hsCode || "");
  const leaf = getLeaf(corpus.byCode, hs);
  if (leaf) {
    const value = Number(body.shipmentValue) || 18000;
    const pct = leaf.dutyPct != null ? leaf.dutyPct : 0;
    return {
      customsDutyPercent: pct,
      vatPercent: DEFAULT_IMPORT_VAT_PERCENT,
      feeRub: customsOperationsFeeFromUsd(value),
      engine: "llm-lookup-v1",
      hsCode: leaf.codeDisplay,
      dutyKind: leaf.dutyKind || undefined,
      dutyNote: leaf.dutyNote || undefined,
    };
  }
  const matched = RULES.find((r) => r.hsCode === hs);
  const row = matched || DEFAULT;
  const value = Number(body.shipmentValue) || 18000;
  return {
    customsDutyPercent: row.duty,
    vatPercent: DEFAULT_IMPORT_VAT_PERCENT,
    feeRub: customsOperationsFeeFromUsd(value),
    engine: "llm-stub-v0",
    hsCode: hs || row.hsCode,
  };
}

function candidatePayload(cands) {
  return cands.map((c) => ({
    hsCode: c.codeDisplay,
    titleRu: c.titleRu,
    score: c.score,
  }));
}

function lexicalClassify(body = {}) {
  const text = classifyText(body);
  const cands = corpus.loaded ? lexicalCandidates(text, corpus.leaves, TOP_K) : [];
  if (!cands.length) {
    const stub = stubClassify(body);
    return {
      ...stub,
      candidates: [],
      corpusMiss: true,
      disclaimer:
        "Корпус ТН ВЭД не дал кандидатов (llm-lookup miss). Stub-рекомендация, не live web и не финальный код.",
    };
  }
  const top = cands[0];
  return {
    hsCode: top.codeDisplay,
    confidence: Math.min(0.88, 0.55 + Math.min(0.3, top.score / 80)),
    engine: "llm-lookup-v1",
    disclaimer: "Лексический подбор по корпусу ТН ВЭД (llm-lookup-v1). Рекомендация, не финальный код — нужна проверка брокера.",
    inputPreview: text.slice(0, 200),
    candidates: candidatePayload(cands),
    corpusMiss: false,
  };
}

async function chatJson(system, user, model) {
  const res = await fetch(`${openaiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
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
    signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || 30000)),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`openai ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content);
}

async function openaiRerankClassify(body = {}) {
  const text = classifyText(body);
  const cands = corpus.loaded ? lexicalCandidates(text, corpus.leaves, TOP_K) : [];
  if (!cands.length) {
    // No corpus hit — fail-open to stub, do not free-invent HS / live web
    return lexicalClassify(body);
  }

  const allowed = new Set(cands.map((c) => c.code));
  const parsed = await chatJson(
    'Ты классификатор товаров по ТН ВЭД ЕАЭС. Выбери код ТОЛЬКО из списка candidates. Ответь строго JSON: {"hsCode":"<точный codeDisplay из списка>","confidence":0-1,"disclaimer":"<кратко по-русски>"}. Поле disclaimer — на русском. Не придумывай код вне списка.',
    JSON.stringify({
      title: body.title || "",
      description: body.description || "",
      visionDescription: body.visionDescription || "",
      country: body.country || "",
      candidates: cands.map((c) => ({ hsCode: c.codeDisplay, titleRu: c.titleRu })),
    }),
    classifyModel
  );

  let dig = digitsHs(parsed.hsCode);
  if (!allowed.has(dig)) {
    // try match spaced / partial
    const match = cands.find((c) => c.codeDisplay === String(parsed.hsCode || "").trim());
    dig = match ? match.code : cands[0].code;
  }
  const chosen = getLeaf(corpus.byCode, dig) || cands[0];
  return {
    hsCode: chosen.codeDisplay,
    confidence: Math.min(0.95, Math.max(0.5, Number(parsed.confidence) || 0.75)),
    engine: "llm-openai-v1",
    disclaimer:
      parsed.disclaimer ||
      "Выбор модели среди кандидатов корпуса ТН ВЭД — рекомендация, не финальный код.",
    inputPreview: text.slice(0, 200),
    candidates: candidatePayload(cands),
  };
}

function dutyFromCorpusOrStub(body = {}) {
  return stubDuty(body);
}

async function classify(body) {
  if (providerMode === "openai" && corpus.loaded) {
    try {
      return await openaiRerankClassify(body);
    } catch (e) {
      console.warn("[classification] openai classify failed, lexical:", e instanceof Error ? e.message : e);
      return lexicalClassify(body);
    }
  }
  if (corpus.loaded) return lexicalClassify(body);
  return stubClassify(body);
}

async function duty(body) {
  // Duty always from corpus/stub schedule — never ask LLM for rates on MVP
  return dutyFromCorpusOrStub(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);

  if (url.pathname === "/health") {
    res.end(
      JSON.stringify({
        ok: true,
        service: "llm",
        provider: providerMode,
        profile: compat.profile,
        models: [classifyModel, dutyModel],
        engine: providerMode === "openai" ? "llm-openai-v1" : corpus.loaded ? "llm-lookup-v1" : "llm-stub-v0",
        corpus: { loaded: corpus.loaded, leaves: corpus.leaves.length, path: corpus.path },
        topK: TOP_K,
      })
    );
    return;
  }

  try {
    if (req.method === "POST" && url.pathname === "/v1/classify") {
      const body = await readBody(req);
      if (!body.description && !body.title && !body.visionDescription && !body.name) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "description, title, name or visionDescription required" }));
        return;
      }
      res.end(JSON.stringify(await classify(body)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/duty") {
      const body = await readBody(req);
      res.end(JSON.stringify(await duty(body)));
      return;
    }
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found", hint: "POST /v1/classify | POST /v1/duty" }));
});

server.listen(port, () =>
  console.log(
    `[classification] provider=${providerMode} profile=${compat.profile} corpus=${corpus.loaded ? corpus.leaves.length : 0} on :${port}`
  )
);
