# AI pipeline (контракт)

```text
ClientRequest
    → precedent lookup (БД-2, gate llmEnrichEnabled)   # hit → precedent-v1, skip LLM
    → containers/ai        # draft: heuristic-v1
    → containers/llm       # optional: corpus lookup + LLM pick
    → BrokerQueue
    → BrokerConfirm        # approve → write-back БД-2
    → ClientResult + PDF
```

Целевой конвейер (срез 1 **последовательный** Qwen-VL → reset → DeepSeek на `AI_DRAIN`, брокер остаётся): [`plan-ai-mesh.md`](./plan-ai-mesh.md). As-is цепочка выше **не ломается**: heuristic `AI_READY` сразу; overlay HS с job.

## Heuristic API (`containers/ai`)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/v1/draft` | `{ description, title?, country?, docs[] }` | `{ hsCode, duties, documents[], confidence, disclaimer, engine, llmEnrich? }` |
| GET | `/health` | — | `{ ok: true, engine }` |

Engine: **heuristic-v1** (C3 / D21). Правила — [`src/lib/ved/ai-draft-rules.json`](../../src/lib/ved/ai-draft-rules.json); `src/lib/ved/ai.ts` → `AI_SERVICE_URL`.  
Enrich: [`enrich-llm.js`](../../containers/ai/src/enrich-llm.js) при `LLM_SERVICE_URL` + gate `llmEnrichEnabled` — fail-open (ошибка llm не валит create).  
Порог confidence и эскалация — настройки админки «AI-качество».  
Юридически: рекомендация, не финальное решение. **D27:** клиентский UI не обещает «LLM без кода» — enrich backend-only.

## LLM (`containers/llm`)

Контракт: [`d-draft.llm.json`](../contracts/d-draft.llm.json). UI **не** вызывает llm.

| Method | Path | Response |
|--------|------|----------|
| POST | `/v1/classify` | `{ hsCode, confidence, engine, disclaimer, candidates?[] }` |
| POST | `/v1/duty` | `{ customsDutyPercent, vatPercent, feeRub, engine, dutyKind?, dutyNote? }` |
| GET | `/health` | `{ ok, provider, models, corpus?, topK }` |

### Engines (`engine` tag)

| Tag | Когда | Поведение |
|-----|-------|-----------|
| `llm-stub-v0` | нет `OPENAI_API_KEY` / нет корпуса | regex rules |
| `llm-lookup-v1` | корпус загружен, без LLM или fallback | lexical top-K → top-1 |
| `llm-openai-v1` | `OPENAI_API_KEY` + корпус | lexical top-K → LLM **только** из `candidates` |
| `precedent-v1` | hit в `verified_determinations` | fingerprint / lexical ≥ threshold; **без** вызова LLM |
| `precedent-v2` | hit через pgvector embedding | semantic cosine ≥ `PRECEDENT_VECTOR_THRESHOLD`; **без** LLM classify |

Fail-open chain: precedent DB error → skip · openai error → lexical top-1 → stub. Create calc не падает (S6).

### Precedent-first (БД-2)

Перед AI/LLM (`requestAiDraft`, api create, CSV preview row):

1. `buildCanonicalText(name + title + description + attrs)`
2. exact `fingerprint` → hit (`precedent-v1`)
3. иначе pgvector cosine (если `OPENAI_API_KEY` + embedding column) → `precedent-v2`
4. иначе lexical top among recent precedents (`PRECEDENT_SCAN_LIMIT`)
5. при score ≥ `PRECEDENT_MATCH_THRESHOLD` → `precedent-v1`

Write-back: `approve` → `recordVerifiedFromApprove` (per item, fail-open). Если клиент поставил 👍 на черновик — `quality=CLIENT_HELPFUL` (+0.05 lexical). Брокер на GET calc видит `similarPrecedents`. См. [`data-model.md`](./data-model.md) §2.2 · [`plan-precedent-bulk.md`](./plan-precedent-bulk.md) · [`plan-llm-fill-hints.md`](./plan-llm-fill-hints.md).

### Fill-stage attr chips (не classify CTA)

`POST /api/v1/calculations/attr-suggest` — session; heuristic по названию («майка» → состав/материал/тип/возраст/цвет в **те же** поля). UI не зовёт модель. Classify overlay HS — hold.

### CSV / XLSX product import (preview)

`POST /api/v1/imports/products/preview` — parse CSV или XLSX (`xlsxBase64` / multipart) → per-row precedent → LLM classify.  
Лимит D10 по тарифу. UI: `ProductCsvImport` в NewCalc → apply / create.  
Код: `src/lib/ved/product-import.ts`.

### Broker reclassify

`POST /api/v1/calculations/:id/reclassify` — брокер передаёт `brokerFeedback`; LLM classify **без** precedent; обновляет `hsCodeAi` / calc HS; статус `IN_REVIEW`. UI: WorkMapping.

### Lookup-v1 (corpus)

При старте: `TNVED_CODES_PATH` (compose: `../llm/data/tnved/normalized` → `/data/tnved/codes.jsonl`, ~13k leaves).

1. Lexical top-K (`LLM_LOOKUP_TOP_K`, default 10) по `titleRu`
2. При `OPENAI_API_KEY`: prompt на русском — выбор **только** из candidates
3. `/v1/duty`: `dutyPct` листа + VAT 22% (`DEFAULT_IMPORT_VAT_PERCENT`) + сбор ПП 1637 ([`customs-fees.ts`](../../src/lib/ved/customs-fees.ts)); не «угадайка» модели

Опционально в classify response: `candidates[]` — `{ hsCode, titleRu, score }` (для broker QC / smoke).

### Env (compose / local staging)

| Env | Назначение |
|-----|------------|
| `OPENAI_API_KEY` | NVIDIA / default OpenAI-compatible (OCR + embeddings; classify if `LLM_PROVIDER` unset) |
| `OPENAI_BASE_URL` | default OpenAI; staging: NVIDIA NIM `https://integrate.api.nvidia.com/v1` |
| `LLM_CLASSIFY_MODEL` / `LLM_DUTY_MODEL` | NVIDIA/OpenAI profile (напр. `meta/llama-3.1-8b-instruct`) |
| `LLM_PROVIDER` | classify-only: `deepseek` \| `qwen` \| `nvidia` — one adapter, not parallel mesh ([`plan-ai-mesh.md`](./plan-ai-mesh.md) срез 0) |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` | local: `https://api.deepseek.com/v1`, `deepseek-chat` |
| `QWEN_API_KEY` / `QWEN_BASE_URL` / `QWEN_MODEL` | DashScope compatible-mode `https://dashscope.aliyuncs.com/compatible-mode/v1`, `qwen-plus`; vision: `QWEN_VISION_MODEL=qwen-vl-plus` |
| `LLM_TIMEOUT_MS` | default 30000 для NIM |
| `TNVED_CODES_PATH` | путь к `codes.jsonl` |
| `LLM_SERVICE_URL` | **внутри compose** всегда `http://llm:4500` (не `127.0.0.1` из host `.env`) |
| `PRECEDENT_MATCH_THRESHOLD` | default `0.85` — lexical hit для БД-2 |
| `PRECEDENT_SCAN_LIMIT` | max precedents scanned (default `200`) |
| `PRECEDENT_VECTOR_ENABLED` | `0` = disable pgvector path |
| `PRECEDENT_EMBED_MODEL` | OpenAI-compatible embed model (NVIDIA: `nvidia/nv-embedqa-e5-v5`) |
| `PRECEDENT_EMBED_DIM` | vector column dim (default `1024`) |
| `PRECEDENT_VECTOR_THRESHOLD` | cosine similarity min for `precedent-v2` (default `0.78`) |
| `OCR_SERVICE_URL` | create/import fallback к `ocr:4700` |
| `OCR_VISION_MODEL` | vision-capable model (отдельно от `LLM_CLASSIFY_MODEL`) |
| `OCR_TIMEOUT_MS` | default `20000` |

Gate: `llmEnrichEnabled` в platform settings (D28) — при `false` enrich пропускается.

## OCR (`containers/ocr`)

Контракт: [`d-ocr.ai.json`](../contracts/d-ocr.ai.json). UI **не** вызывает ocr напрямую (только domain / import preview).

| Method | Path | Назначение |
|--------|------|------------|
| POST | `/v1/extract` | attrs из PDF text / vision image |
| POST | `/v1/extract-table` | строки invoice / packing list |
| GET | `/health` | probe + engine hint |

Create: `OCR_SERVICE_URL` + allowlisted `item.mediaUrl` → `extractWithOcr` (fail-open).  
**SSRF:** server-side fetch / OCR handoff только для `/uploads/ved/…`, `${S3_ENDPOINT}/${S3_BUCKET}/…`, или `MEDIA_URL_ALLOWED_PREFIXES` (`src/lib/ved/media-url.ts`). Direct Qwen на Vercel — FS для local path, иначе `fetch` с `redirect: "error"`.  
Import: `parseProductPdf` → fallback `extract-table`.  
Vision (`imageBase64`): **backend ready**, product wire **hold** — ждём `OPENAI_API_KEY` + UI; план: [`plan-ocr-vision.md`](./plan-ocr-vision.md).

Два слоя ТН ВЭД: corpus (llm lookup) vs Prisma `TnvedCode` (broker search) — [`data-model.md`](./data-model.md) §2.1.
