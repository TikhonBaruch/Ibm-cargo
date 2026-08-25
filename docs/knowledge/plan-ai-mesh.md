# План: конвейер расшифровки (схема логистов)

**Дата:** 2026-08-15.  
**Цикл D33.** Этот файл — **план до кода**. Реализация mesh — отдельные циклы (срезы 1–5).  
Канон: [`feature-cycle.md`](./feature-cycle.md) · ADR D26 (orch) · D27 (MVP) · D30 (OCR / multi-LLM hold).  
Связано: [`plan-global.md`](./plan-global.md) (этап 3) · [`ai-pipeline.md`](./ai-pipeline.md) · [`growth.md`](./growth.md) · [`plan-ocr-vision.md`](./plan-ocr-vision.md) · [`plan-precedent-bulk.md`](./plan-precedent-bulk.md) · [`containerization.md`](./containerization.md).

Источник идеи: схема «Система логистов» (вход → распределение → несколько расшифровок → единый формат → ТН ВЭД / RAG → модератор → клиент).

## Идея

Кабинеты (client / broker / manufacturer / admin) закрывают **правый край** схемы: человек видит черновик, правит, отдаёт PDF.  
Следующая сборка — **позвоночник слева**: входящий пакет → распределитель → параллельные расшифровки (`ocr` / `ai` / `llm`) → сводка в один формат → брокер-QC.

Не новый кабинет и не замена MVP.

## Анализ

Сейчас create линейный и fail-open ([`src/lib/ved/calculations.ts`](../../src/lib/ved/calculations.ts)):

```text
форма / CSV / upload
  → OCR (если mediaUrl)
  → heuristic draft (`containers/ai`)
  → optional LLM enrich (`containers/llm`)
  → AI_READY → pay → очередь брокера → PDF
```

На схеме входящее сначала кладётся в хранилище, затем **три независимых расшифровки**, затем локальный шаг **сводит в один запрос**, и только тогда классификатор + ТН ВЭД + модератор.

`BackgroundJob` сегодня: `SLA_TICK` / `OUTBOX_DRAIN` ([`orchestration.ts`](../../src/lib/ved/orchestration.ts)). Kind `AI_DRAIN` есть в [`d-orch.core.json`](../contracts/d-orch.core.json), как распределитель пакетов не живёт.

### Карта схемы → as-is

```text
ingest (cabinet / CSV / upload)
  → distributor          # нет
  → ocr | ai | llm       # есть, вызываются линейно
  → unify                # нет (attrs + draft ad hoc)
  → broker QC            # WorkMapping
  → PDF
```

| Блок схемы | Репо | Статус |
|------------|------|--------|
| Формы приложения | кабинеты client / broker / manufacturer | **live** |
| Excel | `ProductCsvImport` / preview | **live** |
| Почта / Telegram как вход | — | **не сейчас** (срез 4) |
| S3 + БД | uploads + Prisma | **live** |
| Распределитель / Kanban пакета | — | **нет** |
| Расшифровка онлайн | `containers/llm` classify/duty | optional, fail-open |
| Расшифровка локальная рабочая | `containers/ai` heuristic-v1 | **live** |
| Расшифровка тестовая | multi-LLM router | **hold D30** |
| Сводка единого формата | нет отдельного шага | **нет** |
| База ТН ВЭД | корпус `codes.jsonl` + `TnvedCode` | **live** |
| Парсинг внешних источников | не scrape Alta/TKS; KEY позже | **hold** |
| Вектор готовых решений | `verified_determinations` | lexical live; pgvector **hold D30** |
| Модератор-человек | брокер: claim → mapping → approve | **live, навсегда** |
| Ответ клиенту | PDF + чат + feedback | **live** |

## Жёсткие рамки

1. **MVP D27 не ломаем:** heuristic draft → оплата → очередь брокера → PDF. Экспресс при высокой confidence — как сейчас.
2. **Брокера из процесса не убираем.** Люди работают с людьми. Фраза схемы «посредник исчезает» = сужается зона авто-DONE (прецедент / высокая уверенность), **не** исчезновение роли на площадке.
3. Не скрейпить CustomsOnline / Alta / TKS. Ставки — корпус + позже лицензионный KEY.
4. UI кабинетов в срезах 1–2 **не переписывать**. Брокер по-прежнему видит заявку после `AI_READY` / оплаты.
5. Telegram / email как канал входа — только после позвоночника (срезы 1–2), тот же пакет, не второй пайплайн.
6. Dual-path: любой код mesh — Next + [`containers/api`](../../containers/api/).

## Структура (срезы = отдельные циклы D33)

Код **mesh** (срезы 1–5) — отдельные циклы. Срез 0 ниже — только смена OpenAI-compatible бэкенда через env.

### Срез 0 — локальные OpenAI-compatible профили (этот цикл)

**Не** срез 5 (параллельный multi-LLM router, hold D30) и **не** новый AI-стек.  
Канон: LBM **не** зовёт модель из UI; `containers/ai` enrich → `LLM_SERVICE_URL` → **`containers/llm`** (LBM-owned); envelope [`d-draft.llm.json`](../contracts/d-draft.llm.json); fail-open; gate `llmEnrichEnabled`; D27 — opt-in URL/env, не CTA.

Один активный chat-провайдер через уже существующий `POST …/chat/completions`. Смена модели = env, не новый сервис и не новые поля classify/duty.

| Путь | Кто читает ключ | Зачем |
|------|-----------------|--------|
| `OPENAI_API_KEY` + `OPENAI_BASE_URL` | `llm` classify **и** OCR vision / precedent embeddings | Локально NVIDIA NIM — **не затирать** |
| `LLM_SERVICE_URL` | domain / `containers/ai` | HTTP до classification, без ключа модели в Next |
| Named classify-only | только сервис `llm` | Qwen / DeepSeek, чтобы не сломать embeddings на NIM |

1. Gitignored: `QWEN_API_KEY`, `DEEPSEEK_API_KEY` (+ optional `*_BASE_URL` / `*_MODEL`).
2. `LLM_PROVIDER=deepseek|qwen|nvidia` — резолв в тот же adapter (`engine` остаётся `llm-openai-v1`).
3. Compose: named vars **только** на сервис `llm`. OCR / api по-прежнему `OPENAI_*` (NIM).
4. `.env.example` / `docker.env.example` — плейсхолдеры, без секретов. Ключи **не** в KB / contracts / UI.

Локальный default classify: **DeepSeek** (`https://api.deepseek.com/v1`, `deepseek-chat`). Qwen: DashScope compatible-mode `https://dashscope.aliyuncs.com/compatible-mode/v1` (`qwen-plus`); intl — комментарий в env. Формат DashScope-ключа может быть нестандартным — хранить как есть.

Проверка среза 0: `GET /health` показывает `profile` без ключа; create без `LLM_SERVICE_URL` не меняется; ошибка провайдера → lexical / stub.

### Срез 1 — последовательный Qwen → DeepSeek (`AI_DRAIN`) — **Compose only**

**Статус (2026-08-21):** Compose live + **Vercel direct providers**.  
- Compose: `OCR_SERVICE_URL`/`LLM_SERVICE_URL` + keys on ocr/llm.  
- Vercel: `LLM_PROVIDER`/`DEEPSEEK_*`/`QWEN_*` on Next → `provider-mesh` (no docker URL).  
Create → draft enrich → **inline** `AI_DRAIN`; job `DONE` для orch; worker/cron = retry.

**Именование:** в продукте — **AI-контур** (Qwen-VL → DeepSeek); репозиторий `/llm` — **матрица ИИ-сервисов** (HTTP classification/OCR). Не путать с FSM расчёта в LBM.

**Точность кандидатов (2026-08-21):** chapter/heading-hint раньше lexical; стоп-токен `носки`; synonym→leaf score (`640411`, `610910`, `847130`, `851713`, `853952`); при `hsCode:null` — lexical fallback в главе, не чужой heuristic.

### Срез 1c — устойчивость: failover + отложенные повторы (план)

**Статус (2026-08-21): внедрено.** `LLM_CLASSIFY_CHAIN`, requeue 30s→2m→5m→15m, логи `[ai-drain]`, `maxDuration=180`, poll 180s. Тесты `ai-drain-failover.test.ts`.

**Цель:** при недоступности Qwen и/или DeepSeek заявка не «замирает» с ложным финалом; клиент либо получает точный код после ретраев, либо явный pending → heuristic с пометкой «без LLM».

#### As-is (2026-08-21) — что реально происходит

```text
create
  → heuristic/precedent AI_READY + llmEnrichPending
  → BackgroundJob AI_DRAIN QUEUED
  → after() сразу: finishQueuedAiDrainForCalc
       ├─ Qwen-VL describe (если mediaUrl)
       │     fail → soft: текст без vision, ServiceCall FAILED soft
       ├─ DeepSeek classify (один LLM_PROVIDER)
       │     ok → overlay hs + llmEnrich, pending=false, job DONE
       │     miss/error → clear pending, job DONE(skipped) или FAILED
       └─ клиент poll ≤120s
  → cron jobs-tick */2m — claim QUEUED AI_DRAIN (если after не успел)
```

| Сбой | Поведение сейчас | Проблема |
|------|------------------|----------|
| Qwen down / empty | **requeue** AI_DRAIN (`vision-wait`); classify только после OK или **последней** попытки | см. [`plan-vision-before-classify.md`](./plan-vision-before-classify.md) |
| DeepSeek timeout/5xx | ServiceCall FAILED; `finishQueuedAiDrainForCalc` → job **FAILED** (без `runAfter`) | **нет авто-ретрая** на Vercel after()-пути |
| DeepSeek miss (null) | `provider-miss` + **pending снят**, job DONE skipped | клиент видит heuristic как «готово» |
| Нет ключа / нет кандидатов | то же miss | нет цепочки запасных провайдеров |
| `jobs-tick` claim | `finishBackgroundJob(ok:false)` → QUEUED + `runAfter` ≈ attempts×30s | работает **только** если job остался QUEUED; after() часто ставит FAILED сразу |
| Admin | `/admin/orch` manual retry | есть, не для клиента |

Дублирования провайдеров **нет**: classify = один `resolveOpenAiCompat(LLM_PROVIDER)`. Qwen ключ только для vision; DeepSeek — для classify. Поменять ролями через env можно, но не failover в одном прогоне.

#### Целевая схема (алгоритм)

**Инварианты**
1. Заявка всегда в `AI_READY` (fail-open create) — оплата/брокер не блокируются.
2. `llmEnrichPending=true` пока нет успешного classify **или** исчерпаны попытки (DEAD).
3. Брокер-QC остаётся финалом; LLM — рекомендация.
4. Не звать UI→модель; только domain / after / cron / worker.

```text
                    ┌─────────────────────────────────────┐
                    │  AI_DRAIN attempt N (1..maxAttempts) │
                    └─────────────────────────────────────┘
                                      │
              mediaUrl? ──yes──► Qwen-VL describe (≤ OCR_TIMEOUT_MS, default 90s)
                      │              │
                      │         ok → classify
                      │         empty/fail → requeue (vision-wait); last attempt → classify без vision
                      ▼              ▼
              ┌─ Classify chain (внутри attempt) ─┐
              │ 1. Primary: DeepSeek (или LLM_PROVIDER)
              │ 2. Secondary: Qwen-chat (если ключ и primary fail/timeout)
              │ 3. Tertiary: lexical top в chapter-hint (llm-lookup-v1)
              └──────────────┬────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │ success (hs + engine)       │ soft-only lexical?
              │ overlay + pending=false     │ overlay low conf + pending=false
              │ job DONE                    │  OR keep pending + requeue*
              └─────────────────────────────┘
                             │ hard fail (оба API down, нет кандидатов)
                             ▼
              job QUEUED + runAfter[N] + pending=true
              (не FAILED навсегда до maxAttempts)
                             │
              cron / worker claim when runAfter ≤ now
                             │
              attempts ≥ max → DEAD, pending=false,
              disclaimer «AI временно недоступен, код предварительный»
```

\*Политика lexical: **вариант A (рекомендуем)** — lexical сразу отдаём клиенту (как сейчас fallback), но ставим `aiDraft.llmRetryWanted=true` и отдельный job/флаг для «дожать» primary при восстановлении API. **Вариант B** — lexical не снимает pending, клиент ждёт до DEAD (дольше, точнее primary).

#### Расписание повторов (разные интервалы)

Уже есть задел в `finishBackgroundJob`: `runAfter = now + min(attempts,10)*30s`. Для AI_DRAIN зафиксировать **явную таблицу** (не линейную):

| attempt | delay до следующего | смысл |
|---------|---------------------|--------|
| 1 (after) | 0 | сразу после create |
| 2 | **30s** | краткий сбой / rate limit |
| 3 | **2 min** | деградация API |
| 4 | **5 min** | |
| 5 | **15 min** | |
| 6 (max) | — | DEAD + снять pending |

`maxAttempts` для `AI_DRAIN` = **6** (отдельно от default 5 outbox). Cron `*/2 * * * *` покрывает шаги ≥2 min; шаг 30s — либо короткий `wait` в after (осторожно с maxDuration), либо чаще tick, либо `after` + `setTimeout` недоступен — **полагаться на jobs-tick + ручной admin**. Для 30s на Vercel Hobby: допустимо пропустить и начать с 2 min, либо поднять частоту cron до `*/1`.

#### Дублирование провайдеров (classify)

```text
LLM_CLASSIFY_CHAIN=deepseek,qwen   # env, порядок
```

1. Для каждого имени в chain: если ключ есть → `chat/completions` с тем же JSON-схемой кандидатов.
2. Первый успешный parse ∈ candidates → stop.
3. Все timeout/5xx → следующий.
4. Все исчерпаны → lexical fallback (если есть candidates) **или** requeue attempt.

Qwen-VL **не** заменяет DeepSeek для classify без ключа chat; при `QWEN_API_KEY` тот же DashScope compatible-mode уже умеет text models (`QWEN_MODEL`).

Vision: без Qwen — не блокируем; optional второй vision позже (hold).

#### Что править в коде (когда реализуем срез)

1. `finishQueuedAiDrainForCalc` → на hard fail вызывать `finishBackgroundJob({ ok:false, attempts })` с **AI delay table**, **не** снимать `llmEnrichPending` до успеха/DEAD.
2. `provider-miss` / API down: различать `retriable` vs `terminal` (нет кандидатов = terminal lexical/heuristic; 503/timeout = retriable).
3. `classifyWithProvider` → `classifyWithProviderChain(env.LLM_CLASSIFY_CHAIN)`.
4. Client poll: если pending после 120s — оставить баннер «уточняем в фоне» + poll реже / websocket later; не показывать как финальный провал.
5. Admin orch: список DEAD AI_DRAIN + one-click retry (уже почти есть).
6. Метрики: ServiceCall by provider + job attempts в `/admin/orch`.

**Не делать в этом срезе:** параллельный multi-LLM router (D30 hold); scrape; второй FSM статуса расчёта.

#### Проверка среза 1c

- Unit: delay table; chain skips missing keys; retriable vs terminal.
- Chaos: mock DeepSeek 503 → Qwen ok; оба 503 → QUEUED runAfter; max → DEAD pending false.
- Prod: один calc с выключенным ключом primary (staging only).

### Срез 2 — сводка


**Цель:** клиенту нужен **точный** ответ AI-контура, не быстрый heuristic. До 120s ожидания ок.

**Проблема:** inline `await runAiDrainPipeline` в create держал HTTP без байт → клиент/прокси `ETIMEDOUT`, хотя calc уже в БД. Плюс create уже звал DeepSeek в `enrichDraftWithLlm`, затем снова в `AI_DRAIN`.

**План:**
1. Create: heuristic/precedent → enqueue `AI_DRAIN` → `llmEnrichPending` → **быстрый 201** (без await drain).
2. `after()` на `POST /calculations` сразу гоняет drain (`maxDuration=120`); cron `jobs-tick` каждые 2 мин — запасной.
3. Кабинет: poll GET до 120s, пока pending; UI «Уточняем ТН ВЭД…»; открыть заказ с финальным `hsCode`/`llmEnrich`.
4. Drain пишет в `aiDraft` (`llmEnrich`, disclaimer, confidence) и снимает pending.
5. Sync `enrichDraftWithLlm` на create **пропускать**, если будет `AI_DRAIN` (один вызов модели).

**Починка 2026-08-21:** api был на сети `lbm_lbm`, postgres — на `lbm_default` без общего DNS; `DATABASE_URL` ждал `lbm`/`lbm`, том — `lbm`. Таймаут enrich был 3–4s. Исправлено: compose `POSTGRES_*=lbm`, сеть+alias, `LLM_TIMEOUT_MS` 30s, inline drain.

```text
create persist + heuristic AI_READY
  → enqueue BackgroundJob AI_DRAIN { calculationId, hasMedia }
  → worker claim (не stub-OK)
      1. ServiceCall ocr/describe  — Qwen-VL (картинка)
      2. ServiceCall ocr/reset     — сброс сессии Qwen (finally; сбой не валит шаг)
      3. ServiceCall llm/classify  — DeepSeek + visionDescription + корпус ТН ВЭД
  → overlay hsCodeAi (клиентские attrs не затираем)
```

Fail-mode: заявка **не теряется**. Если Qwen/DeepSeek недоступны — job `FAILED`/`TIMEOUT` с полным `error`, retry в `/admin/orch` (ADMIN + SUPER). LLM-шаг **не** помечается OK. Worker **не** закрывает неизвестный kind как `stub: true`.

Qwen reset: stateless describe (без `session_id`/history) + отдельный chat без картинки после каждого describe. Картинка не в `requestMeta`.

Открытые источники = уже собранные слои (`TnvedCode` / `codes.jsonl` / notes). Не scrape Alta/TKS, не live web.

Ключи: `QWEN_*` на `ocr`, `DEEPSEEK_*` на `llm`. Не на Vercel. UI не зовёт модели.

Контракт: [`d-ai.pipeline.json`](../contracts/d-ai.pipeline.json) · `ServiceCall.service=ocr` в [`d-orch.core.json`](../contracts/d-orch.core.json).

Проверка: `npm run test:ci`; compose: две разные картинки подряд без «глюка» первой; Vercel — `smoke:mvp` heuristic.

### Срез 2 — сводка

Один envelope до `AI_READY`: attrs + HS-кандидаты + инвойс (см. [`plan-landed-without-freight.md`](./plan-landed-without-freight.md)). Если есть published SKU завода — подмешать эталон. Не новый drawer.

### Срез 3 — RAG как основной путь

Precedent-first уже в create ([`plan-precedent-bulk.md`](./plan-precedent-bulk.md)). Embed / pgvector — когда ключ (D30). Write-back на approve брокера не трогать.

### Срез 4 — каналы входа

Excel уже. Почта / Telegram кладут **тот же** пакет в распределитель среза 1. Канонический UI — кабинеты.

### Срез 5 — песочница модели

Третья колонка схемы (test local) = multi-LLM router (D30), тег `engine`, не прод-CTA, не «LLM без кода» на лендинге.

## Проверка (срез 1)

| Среда | Что проверять |
|-------|----------------|
| CI / unit | `npm run test:ci` — dual-path create + `AI_DRAIN` enqueue; worker не stub-OK |
| Compose | `QWEN_*`/`DEEPSEEK_*` на `ocr`/`llm` → describe→reset→classify; `/admin/orch` ServiceCall; job `FAILED` при мёртвых ключах |
| Hobby | `smoke:mvp` heuristic only; **не** ставить model keys на Vercel |

Кабинеты без регрессии. Extract `containers/manufacturer` — Compose/C5, не отдельный Hobby app.

## Не входит

Срез 5 параллельный router / Ollama. Новые кабинеты. Shipping CTA. Авто-релиз вместо брокера. Скрейп справочников. Деплой ключей Qwen/DeepSeek на Vercel. Блок `AI_READY` до конца моделей.
