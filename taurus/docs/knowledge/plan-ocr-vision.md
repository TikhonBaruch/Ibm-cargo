# План: OCR / PDF / vision (`imageBase64`) — Growth local

Поэтапный статус **AI OCR** (P2) для LBM Брокер + LLM matrix.  
Не меняет **D27 CTA**: нет «распознай всё без брокера» на prod.  
Связано: [`growth.md`](./growth.md) §OCR · [`ai-pipeline.md`](./ai-pipeline.md) · контракт [`d-ocr.ai.json`](../contracts/d-ocr.ai.json) · [`data-model.md`](./data-model.md) §1 (attrs).

---

## As-is (2026-08-12)

| Слой | Статус | Детали |
|------|--------|--------|
| Контейнер `ocr` (:4700) | **partial** | `containers/ocr` + зеркало `llm/services/ocr` |
| Create path | **wired** | `createAndDraftCalculation` → `extractWithOcr` при `OCR_SERVICE_URL` + `item.mediaUrl` (fail-open) |
| Import preview | **wired** | CSV / XLSX / **text-layer PDF** в `ProductCsvImport` |
| Text PDF | **done** | `parseProductPdf` (unpdf) + `ocr-pdf-table-v1` fallback |
| Vision (фото/скан) | **backend only** | `imageBase64` в OCR API; **нет** UI / domain wire |
| Multi-LLM router | **hold** | Kimi / DeepSeek — нет ключей |

### Engines (`d-ocr.ai.json`)

| Engine | Вход | Где используется |
|--------|------|------------------|
| `ocr-stub-v0` | hint / filename | нет документа / нет ключа |
| `ocr-pdf-text-v1` | `pdfBase64` / `mediaUrl` PDF | text-layer → attrs |
| `ocr-pdf-table-v1` | text-layer PDF | import preview, `extract-table` |
| `ocr-vision-v1` | **`imageBase64`** + `mimeType` image/* | только прямой вызов OCR; UI не шлёт |

**Важно:** vision **не** принимает PDF binary — только `image/jpeg`, `image/png`, `image/webp` (см. `containers/ocr/src/index.js`: при `mime` с `pdf` vision skip).

---

## Что уже работает без vision-ключа

```bash
npm run test:ci
npm run smoke:pdf-import      # text-layer PDF → preview rows
npm run smoke:csv-import
# compose:
curl -s localhost:4700/health
curl -s localhost:4700/v1/extract-table -H 'content-type: application/json' \
  -d '{"pdfBase64":"…","mimeType":"application/pdf"}'
```

Create с `mediaUrl` на PDF с текстовым слоем: OCR может подтянуть attrs через `POST /v1/extract` (если `OCR_SERVICE_URL` задан).

---

## Hold: ожидание `OPENAI_API_KEY` (и vision-модели)

Vision path (`ocr-vision-v1`) **реализован в OCR-сервисе**, но **не включён end-to-end** в продукте.

### Что нужно от ops / Track A

| Env | Где | Назначение |
|-----|-----|------------|
| `OPENAI_API_KEY` | `ocr` (compose), опционально `llm` | Vision chat + classify/embed |
| `OPENAI_BASE_URL` | то же | OpenAI или **NVIDIA NIM** (`https://integrate.api.nvidia.com/v1`) |
| `OCR_VISION_MODEL` | `ocr` | Модель **с image input** (не любой instruct-only) |
| `OCR_TIMEOUT_MS` | `ocr`, `web`, `api` | default `20000`; vision может быть медленнее |
| `OCR_SERVICE_URL` | `web`, `api` | `http://ocr:4700` (profile `scale`/`full`) |

**Блокеры до live vision:**

1. Нет стабильного ключа на staging (NIM / OpenAI) — **осознанный hold**, как для Kimi/DeepSeek router.
2. Модель classify (`LLM_CLASSIFY_MODEL`, напр. `meta/llama-3.1-8b-instruct`) **≠** vision — для OCR задать отдельно `OCR_VISION_MODEL` (напр. `gpt-4o-mini` или vision-capable NIM).
3. Prod Vercel: без `OCR_SERVICE_URL` create/import vision **не вызывается** (fail-open) — норма для D27.

### Ручная проверка после появления ключа

```bash
# JPEG invoice (base64 без префикса data:)
curl -s localhost:4700/v1/extract-table \
  -H 'content-type: application/json' \
  -d '{"imageBase64":"<…>","mimeType":"image/jpeg","hint":"invoice packing list"}'
# Ожидание: engine=ocr-vision-v1, items[] не пустой
```

---

## Gap: `imageBase64` не доведён до UI/domain

| Компонент | Сейчас | Нужно для E2E vision |
|-----------|--------|----------------------|
| `src/lib/ved/ocr.ts` | только `mediaUrl` | опционально `imageBase64` + `mimeType` |
| `extractWithOcr` callers | create по URL | fetch image URL → base64 **или** клиент шлёт base64 |
| `imports/products/preview` | `pdfBase64` | `imageBase64` + multipart `.jpg/.png` |
| `ProductCsvImport` | `.pdf/.csv/.xlsx` | accept images + base64 |
| Smoke | `smoke:pdf-import` | `smoke:ocr-vision` (skip без ключа) |
| Мониторинг | `ServiceCall.service=ocr` | метрики engine tag в orch / логах |

Два продуктовых сценария (выбрать приоритет в спринте):

| ID | Сценарий | Путь | Ценность |
|----|----------|------|----------|
| **OCR-A** | Фото invoice → таблица позиций | Import preview + `extract-table` + vision | Сканы packing list |
| **OCR-B** | Фото товара → attrs позиции | Create + `extract` + vision | Одна SKU на фото |

Рекомендация: **сначала OCR-A** (переиспользует `ProductCsvImport` и classify pipeline), затем OCR-B.

---

## Рекомендуемые шаги (следующие спринты)

### Спринт 1 — wire vision import (после ключа)

1. Preview API: `imageBase64` + `mimeType` в JSON/multipart.
2. UI: `ProductCsvImport` — `.jpg`, `.png`, `.webp`.
3. Fallback: local parse skip → `POST ocr:4700/v1/extract-table` с `imageBase64`.
4. Smoke: `smoke:ocr-vision` — skip если нет `OPENAI_API_KEY`; иначе fixture JPEG.
5. KB + `testing-branches.md` + `ops:track-a` gate (опционально «vision configured»).

### Спринт 2 — create path для фото товара

1. Расширить `extractWithOcr`: при `mediaUrl` на image/* — server-side fetch → base64 → OCR.
2. Или: upload flow отдаёт base64 в create (тяжелее для API).
3. `ServiceCall` responseMeta: `engine`, `confidence` — уже частично есть.
4. Broker QC: disclaimer `ocr-vision-v1` в EventsTimeline / item attrs read-only.

### Спринт 2b — mediaUrl SSRF harden (Vercel direct Qwen) — **done**

**Идея:** Mode A без `OCR_SERVICE_URL` + `QWEN_API_KEY` делает server-side `fetch(mediaUrl)` в `provider-mesh.fetchMediaAsBase64`. Create принимал любой `http(s)` string → authenticated SSRF.

**Анализ:** UI/uploads отдают только `/uploads/ved/…` или `S3_ENDPOINT/S3_BUCKET/…`. Allowlist этих префиксов + блок fetch/OCR call для остального устраняет регрессию без ломки fail-open vision.

| Фаза | Действие | Done when |
|------|----------|-----------|
| 1 | `src/lib/ved/media-url.ts` — `isAllowedMediaUrl` (local path + S3 base + `MEDIA_URL_ALLOWED_PREFIXES`) | unit ✅ |
| 2 | Gate: `fetchMediaAsBase64`, `extractWithOcr`, create zod, dual-path api create/OCR | ✅ |
| 3 | Local `/uploads/ved/*` — читать с FS (не HTTP); absolute fetch `redirect: "error"` | ✅ |
| 4 | KB `ai-pipeline.md` + этот план | ✅ |

### Спринт 3 — качество и ops

1. Лимиты размера base64 (preview ≤4MB, как PDF).
2. Rate limit / cost guard на vision (admin gate или env cap).
3. Golden fixtures: 3–5 анонимизированных invoice JPEG в `scripts/fixtures/ocr/`.
4. Orch health: `engine` в `GET /health` ocr — уже есть; добавить alert на spike `ocr-stub-v0` в prod.

### Параллельно (не блокирует OCR)

| Тема | Hold | Зависимость |
|------|------|-------------|
| pgvector precedent-v2 | partial | `pgvector` image на compose + embed key |
| Kimi / DeepSeek router | hold | отдельные API keys |
| Scanned PDF без rasterize | hold | PDF→image pipeline (не в scope MVP) |

---

## Мониторинг и Definition of Done

### CI (каждый PR)

```bash
npm run test:ci
npm run smoke:pdf-import
npm run smoke:csv-import
```

### Compose/local (при `scale`/`full`)

| Проверка | Команда / сигнал |
|----------|------------------|
| OCR up | `GET :4700/health` → `ok` |
| Text PDF table | `smoke:pdf-import` PASS |
| Vision (opt-in) | `smoke:ocr-vision` PASS или SKIP (нет ключа) |
| Create OCR | create с `mediaUrl` PDF → `ServiceCall` `service=ocr`, `engine` ≠ stub |
| Orch | `GET /api/v1/internal/orch/health` — probe `ocr` |
| Fail-open | create без `OCR_SERVICE_URL` — не 5xx |

### Метрики для спринт-ревью

- Доля create с `mediaUrl` где `ServiceCall(ocr).status=OK` и `engine` ∈ `{ocr-pdf-text-v1, ocr-vision-v1}`.
- Доля import preview с `rowCount>0` по PDF vs image.
- Latency p95 `OCR_TIMEOUT_MS` breaches (логи api/web).
- **Не** продвигать vision в CTA лендинга до стабильного smoke на staging (D27).

### Track A checklist (когда ключ появится)

```bash
# .env / docker compose — OCR + OPENAI на сервисе ocr
docker compose --profile scale up -d ocr web api
npm run smoke:pdf-import
# после wire imageBase64:
npm run smoke:ocr-vision   # TODO: добавить в спринте 1
npm run ops:track-a        # не требует vision, но фиксирует llm/notify gates
```

---

## Синхронизация LLM matrix

При изменении envelope или engines:

1. `docs/contracts/d-ocr.ai.json`
2. `llm/contracts/d-ocr.ai.json`
3. `containers/ocr` ↔ `llm/services/ocr` (зеркало)
4. [`integration-taurus.md`](../../llm/docs/integration-taurus.md) в matrix repo — при смене transport

---

## Правила обновления этого файла

Обновлять при: новом engine · wire `imageBase64` в UI · появлении ключа на staging · новом smoke · смене hold/CTA.  
ADR hold: **D30** в [`decisions.md`](./decisions.md).  
Связанные файлы: `growth.md` · `current-app.md` · `roadmap.md` §3.6 · `testing-branches.md` · `runbook.md` §OCR · `chain-verification.md`.
