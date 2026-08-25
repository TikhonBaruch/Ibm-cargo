# План: прецеденты (БД-2) + CSV import (локально)

Поэтапная реализация Growth backend **без смены D27 CTA** (нет client UI bulk / «три ИИ»).  
Связано: [`data-model.md`](./data-model.md) §2.2 · [`ai-pipeline.md`](./ai-pipeline.md) · [`growth.md`](./growth.md) §Реальный AI.

## Архитектура (три слоя данных)

| Слой | Хранение | Назначение |
|------|----------|------------|
| **БД-1** Справочник | `TnvedCode` / `TnvedDutyRate` + corpus `codes.jsonl` | Норматив: коды, пошлины, НДС, сборы |
| **БД-2** Прецеденты | `verified_determinations` | Утверждённые брокером пары «описание → HS» |
| **Runtime** | create / import preview | Сначала БД-2 → иначе corpus+LLM |

```text
create / CSV row
  → precedent lookup (fingerprint + lexical, threshold PRECEDENT_MATCH_THRESHOLD)
  → если hit: llmEnrich=precedent-v1 (без вызова LLM)
  → иначе: heuristic → containers/llm lookup-v1 ± openai rerank
approve → recordVerifiedFromApprove (fail-open) → пополнение БД-2
```

---

## Фаза 1 — Schema ✅ (2026-08-12)

| Артефакт | Путь |
|----------|------|
| Prisma model | `VerifiedDetermination` в `prisma/schema.prisma` |
| Migration | `prisma/migrations/20260812130000_verified_determinations/` |

Проверка: `npx prisma generate` · migrate на целевой БД.  
**sweb:** таблица обязательна (Mode A / Vercel); статус sync — [`plan-tech-debt.md`](./plan-tech-debt.md) шаг 1.

---

## Фаза 2 — Domain ✅

| Модуль | Роль |
|--------|------|
| `src/lib/ved/verified-determinations.ts` | `buildFingerprint`, `findBestPrecedent`, `recordVerifiedFromApprove` |
| `src/lib/ved/precedent-enrich.ts` | `tryPrecedentDraft` — apply перед AI/LLM |
| `containers/api/src/verified-determinations.js` | dual-path зеркало |

Env: `PRECEDENT_MATCH_THRESHOLD` (default `0.85`) · `PRECEDENT_SCAN_LIMIT` (default `200`).

Unit: `verified-determinations.test.ts`.

---

## Фаза 3 — Wiring ✅

| Точка | Поведение |
|-------|-----------|
| `approveCalculation` | write-back в БД-2 (fail-open) |
| `requestAiDraft` | precedent **до** `AI_SERVICE_URL` / LLM |
| `containers/api` create | `findBestPrecedent` до ai+llm; skip LLM при `precedent-v1` |

`engine` / `llmEnrich` tag: **`precedent-v1`**.

**Compose DB:** `api`/`web` в docker-compose используют in-network `postgres:5432` (host `DATABASE_URL` на sweb **не** пробрасывается) — иначе write-back молча не срабатывает.

---

## Фаза 4 — CSV / XLSX preview ✅

| Артефакт | Путь |
|----------|------|
| Parser + classify | `src/lib/ved/product-import.ts` (`parseProductCsv` / `parseProductXlsx`) |
| API | `POST /api/v1/imports/products/preview` — `csv` \| `xlsxBase64` \| multipart |
| UI | `ProductCsvImport` в `/cabinet/new` — `.csv` / `.xlsx` / `.xls` → grid → «Подставить» / «Создать заявку» |
| Лимит строк | D10 по `tariffCode` (EXPRESS 1 / STANDARD 3 / PRO 10) |

Per-row: `MATCHED_PRECEDENT` → `CLASSIFIED_NEW` → `LOW_CONFIDENCE` / `PARSE_ERROR`.  
Create: через существующий `POST /calculations` (не отдельный create-from-import endpoint).

Unit: `product-import.test.ts` · Smoke: `npm run smoke:csv-import` (+ live xlsxBase64 preview check).

---

## Фаза 5 — Broker reclassify ✅ (2026-08-12)

| Артефакт | Путь |
|----------|------|
| Domain | `reclassifyCalculation` в `calculations.ts` — feedback → LLM classify (**skip precedent**); статус остаётся `IN_REVIEW` |
| API | `POST /api/v1/calculations/:id/reclassify` + dual-path `containers/api` |
| UI | WorkMapping «Запросить новый код AI» |

Smoke: `npm run smoke:reclassify`.

---

## Фаза 6 — Smoke / CI ✅ (2026-08-12)

```bash
npm run test:ci
npm run smoke:chain-llm      # seed precedent через approve
npm run smoke:precedent-csv  # second create precedent-v1 + CSV MATCHED_PRECEDENT
npm run smoke:csv-import
npm run smoke:reclassify
npm run smoke:full
```

| Script | Результат | Маркеры |
|--------|-----------|---------|
| `smoke:chain-llm` | **PASS** | `llmEnrich=llm-openai-v1`, upload local |
| `smoke:precedent-csv` | **PASS** | `llmEnrich=precedent-v1`, CSV `MATCHED_PRECEDENT` |
| `smoke:csv-import` | **PASS** | preview → create |
| `smoke:reclassify` | **PASS** | broker feedback → new HS (`llm-openai-v1`) |
| `smoke:precedent-vector` | SKIP / PASS | pgvector `precedent-v2`; skip без `OPENAI_API_KEY` |
| `smoke:full` | **PASS** | spine S1–S3 |

Подробнее: [`chain-verification.md`](./chain-verification.md).

---

## Фаза 7 — pgvector embeddings ✅ (2026-08-12)

| Артефакт | Путь |
|----------|------|
| Postgres | `pgvector/pgvector:pg17` + `containers/postgres/init/01-pgvector.sql` |
| Migration | `20260812140000_precedent_embeddings` — `embedding vector(1024)` + HNSW (**fail-open** без extension; sweb = skip) |
| Embed API | `src/lib/ved/precedent-embeddings.ts` — OpenAI-compatible `/v1/embeddings` |
| Lookup | `findBestPrecedent` → fingerprint → **vector** → lexical |
| Write-back | `recordVerifiedFromApprove` stores embedding (fail-open) |
| Backfill | `npm run backfill:precedent-embeddings` |

Tag: **`precedent-v2`** при vector hit. Env: `PRECEDENT_VECTOR_THRESHOLD` (default `0.78`).

Smoke: `npm run smoke:precedent-vector` (skip без `OPENAI_API_KEY`).

---

## Hold (следующие итерации)

| Тема | Статус |
|------|--------|
| LLM router (NVIDIA / Kimi / DeepSeek) | hold — нет ключей Kimi/DeepSeek |
| PDF / photo OCR table | **partial** — text PDF **done**; vision `imageBase64` **hold** · [`plan-ocr-vision.md`](./plan-ocr-vision.md) |
| pgvector embeddings для БД-2 | **done** — precedent-v2 compose/local |
| Client UI bulk preview pane | **done** — `ProductCsvImport` в `NewCalcPane` (2026-08-12) |
| `create-calculation` из import preview | **done** — UI CTA + `smoke:csv-import` |

---

## Правила обновления KB

При изменении precedent/import → обновить: этот файл · `data-model.md` §2.2 · `ai-pipeline.md` · `current-app.md` · `testing-branches.md` · `chain-verification.md`.
