# План: vision обязан завершиться до classify

**Дата:** 2026-08-21. **D33.**  
Канон: [`plan-ai-mesh.md`](./plan-ai-mesh.md) · [`ai-pipeline.md`](./ai-pipeline.md).

## Идея

При `mediaUrl` на позиции Qwen-VL describe должен **дойти до конца** (с достаточным таймаутом) **до** classify. Не классифицировать «только по названию», пока vision soft-fail’ится раньше времени.

## Анализ

Сейчас describe→classify уже последовательны, но:

1. Soft-fail: пустой/упавший describe → сразу DeepSeek по тексту «манго».
2. `fetchMediaAsBase64` обрезан до **15s** даже при `OCR_TIMEOUT_MS=45–90s`.
3. Бюджет route `maxDuration=180` тесен, если vision+classify оба долгие.

## Структура

1. Дефолты: `OCR_TIMEOUT_MS=90000`, media fetch = тот же бюджет (без cap 15s).
2. Gate: если есть `mediaUrl` и настроен Qwen/OCR → без `visionDescription` **не** звать classify; `retriable: true` (AI_DRAIN requeue).
3. Последняя попытка (`attempt >= max`) — soft-fail к classify без vision (fail-open финал).
4. `maxDuration` ai-drain/jobs-tick/create → **300** (vision+classify).
5. Unit + KB / `.env.example`.

## Проверка

- Unit: media + describe fail → no classify, `retriable` (**done**).
- Unit: media + describe ok → classify called (**done**).
- Last attempt without vision → classify allowed (**done**).

**Статус (2026-08-21):** реализовано в `ai-pipeline` / `ai-drain-retry` / `provider-mesh`; дефолт `OCR_TIMEOUT_MS=90000`; client poll `AI_ENRICH_WAIT_MS=300000`.

## Пошаговые логи (ручная проверка upload)

После create с фото смотреть:

1. **Заявка** → `aiDraft.visionTrace` (массив ≤8 `{ phase, status, mime, bytes, errorCode, descriptionLen }`).
2. **`/admin/orch`** → ServiceCall `ocr/describe`: `responseMeta.fetch` + `error` (например `fetch HTTP 400 text/html`).
3. **Vercel logs** → строки `[ai-drain]` с `phase`:
   - `vision-start` → `vision-fetch` → `vision-qwen-request` → `vision-qwen-ok` | `vision-qwen-fail`
   - при fail fetch: `vision-wait` (requeue) без classify
   - `classify-start` только после OK vision (или last attempt)

Не логируются: base64, API keys, полный `mediaUrl` (только `mediaUrlMeta` suffix/sha).

Типичный fail Wikimedia hotlink: `vision-fetch` `status=400` `mime=text/html` `errorCode=http_error` — Qwen не вызывается.
