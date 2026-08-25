# Структура данных VED (D24)

Канон моделей и контрактов для **описаний товаров**, **справочника ТН ВЭД** и **истории запросов**.  
ADR: [`decisions.md`](./decisions.md) **D24**. Очередность записей: [`db-process.md`](./db-process.md).  
Контракты: [`d-product.calc.json`](../contracts/d-product.calc.json) · [`d-tnved.core.json`](../contracts/d-tnved.core.json) · [`d-history.calc.json`](../contracts/d-history.calc.json).  
As-is инвентарь: [`current-app.md`](./current-app.md).  
Поля × роли × обязательность: [`calculation-fields.md`](./calculation-fields.md).

## Что собрано и интегрировано с БД

**Статус:** writers Next + `containers/api` пишут/читают PostgreSQL (Prisma). Schema на sweb через `db push` / migrate.

| Блок | Таблицы / поля | Writers / readers |
|------|----------------|-------------------|
| Описания товаров | `calculation_items.attrs` (JSON), колонки name/qty/… | create `items[].attrs` · UI NewCalcPane / OrderDetail / **broker WorkMapping** (read-only) |
| Каталог производителя (D31) | `manufacturer_skus` (+ `companies.kind`) · `calculation_items.manufacturerSkuId` | `/api/v1/manufacturer/*` (CRUD) · **`GET /api/v1/catalog/skus`** (CLIENT pick PUBLISHED) · dual-path `manufacturer-skus.js` + `catalog-skus.js` |
| Сборный заказ (D34) | `sku_order_requests` · `sku_order_pools` · `companies.clientSegment` | `/api/v1/factory/requests*` · `/api/v1/manufacturer/order-requests*` · `/pools*` · dual-path `sku-order.ts` + `sku-orders.js`. **Не** D8 на Calculation |
| ТН ВЭД | `tnved_codes`, `tnved_duty_rates`; soft `calculation_items.tnvedCode` | search/lookup/import API · HsCodeAutocomplete · seed |
| **Прецеденты (БД-2)** | `verified_determinations` | write-back на `approve` · read на create / CSV preview · [`plan-precedent-bulk.md`](./plan-precedent-bulk.md) |
| История запросов | `calculation_events` (+ FK `actorUserId` → `users`) | append в tx create/pay/claim/map/approve · `GET …/events` · EventsTimeline |
| Support tickets | `chat_threads` (`kind=SUPPORT`, `companyId`, `createdByUserId`) + `chat_messages` | `createSupportTicket` / `scope=support` |
| Calc chat | `chat_threads` (`kind=CALCULATION`, `calculationId`) + messages | claim/chat API |
| Company settings | `companies` (name/inn/contacts) | `PATCH /v1/company` · CompanySettingsPane |

**Инварианты:** D15 mapping truth = item HS/payments; D8 status на `Calculation.status`; D10 лимиты; без `id: "synthetic"`; `tnvedCode` без FK до полного импорта.

**Миграции:** `20260805120000_d24_product_tnved_history` · `20260805140000_support_thread_ownership` · `20260812130000_verified_determinations` · `20260812140000_precedent_embeddings`.

## 1. Описания товаров

Первичные колонки item: `name`, `description?`, `qty`, `unit`, `unitPrice`, `currency`, `mediaUrl`.  
Структура для таможни / AI / OCR ingest — в `attrs` (Zod `productAttrsSchema`).

## 2. Справочник ТН ВЭД

| Модель | Роль |
|--------|------|
| `TnvedCode` | PK = только цифры; дерево `parentCode`; level 2\|4\|6\|8\|10 |
| `TnvedDutyRate` | подсказки duty/VAT/fee (не `TariffPlan.priceRub`) |

HTTP: `GET /v1/tnved/search` (titleRu **или** notes **или** prefix кода), `GET /v1/tnved/:code` (**карточка:** предки, ЕТТ `rate` или `null`, НДС/сбор-hint), `POST /v1/tnved/import` (admin, ≤500).  
ADMIN UI: `/admin/tnved`. CLI (opendata, не CI): `npm run tnved:fetch` → `tnved:normalize` → `tnved:load` (демо) / `tnved:load -- --full` (текущее дерево ФНС, чанки). Манифест: `scripts/data/tnved/manifest.json`. Полный dump в git **не** класть.

### 2.1 Два слоя ТН ВЭД (не смешивать)

| Слой | Хранение | Потребитель | Назначение |
|------|----------|-------------|------------|
| **Corpus lookup** | `matrix/data/tnved/normalized/codes.jsonl` (~13k leaves) | `containers/llm` `/v1/classify` | AI enrich: lexical top-K + LLM pick among candidates |
| **DB catalog** | Prisma `TnvedCode` / `TnvedDutyRate` | Broker + **client** `HsCodeAutocomplete`, admin search/import | QC брокера, UI search |

Импорт в DB: слой A из ФНС `TNVED.ZIP` → `TnvedCode`; демо-срез `demo-pack.json`; CLI чанками. Карточка `GET :code` клеит A+C+D+G; слой B на **local** — fill `TnvedDutyRate.source=tws-csv` (~12 622 листьев с `%`; не НСИ). НСИ СТНВЭДСТ / KZ v4 по-прежнему GAP. Не scrape Alta/TKS. Сборка: [`plan-tnved-collect.md`](./plan-tnved-collect.md).  
Compose mount корпуса для llm: `./matrix/data/tnved/normalized:/data/tnved:ro` — **не** заменяет Prisma seed.

### 2.2 Прецеденты — verified determinations (БД-2)

| Поле / поведение | Описание |
|------------------|----------|
| Модель | `VerifiedDetermination` (`verified_determinations`) |
| Источник записей | **Только** broker `approve` → `recordVerifiedFromApprove` (fail-open) |
| `quality` | `BROKER` (default) или `CLIENT_HELPFUL` если клиент 👍 до approve |
| Ключ поиска | `fingerprint` → pgvector cosine (`precedent-v2`) → lexical (`precedent-v1`) |
| Колонка | `embedding vector(1024)` — HNSW index; write-back на approve |
| Потребители | `requestAiDraft` / api create · `POST /v1/imports/products/preview` per-row · broker GET calc `similarPrecedents` (`listSimilarPrecedents`) |
| Tag | `llmEnrich: precedent-v1` (lexical/fingerprint) или `precedent-v2` (pgvector) |

**Не смешивать** с corpus lookup (§2.1): прецедент = опыт брокера; corpus = номенклатура НСИ.

Код: `src/lib/ved/verified-determinations.ts` · dual-path `containers/api/src/verified-determinations.js`.  
План и smoke: [`plan-precedent-bulk.md`](./plan-precedent-bulk.md) · fill-hints: [`plan-llm-fill-hints.md`](./plan-llm-fill-hints.md).

## 3. История запросов

`CalculationEvent.kind`: `CREATED` → `AI_DRAFT` → `PAID` → `CLAIMED` → `ITEM_MAPPED` → `APPROVED` (+ `STATUS` / `NOTE`).  
HTTP: `GET /v1/calculations/:id/events`. UI: `EventsTimeline`.

## 4. Support / company

| Поле `ChatThread` | Назначение |
|-------------------|------------|
| `companyId` | компания клиента (SUPPORT) |
| `createdByUserId` | кто открыл тикет |
| `kind` | `SUPPORT` \| `CALCULATION` |
| `waitingOn` | чей ход (`CLIENT` \| `BROKER`); на закрытых тикетах `null` |
| `ticketStatus` | только SUPPORT: `OPEN` → `WAITING_CLIENT` → `RESOLVED` / `ARCHIVED` (не D8 Calculation) |
| `resolvedAt` / `archivedAt` | метки закрытия / архива |

List: по `createdByUserId` / `companyId` (legacy: автор сообщения). Клиент: `GET ?scope=support&box=active|archive`. Админ: `box=open|waiting_client|resolved|archived`.  
Мутации: `SUPPORT` (создать), `SUPPORT_REPLY` (только OPEN/WAITING_CLIENT), `SUPPORT_STATUS` (`resolve` \| `archive` \| `reopen`) + system `ChatMessage`. Unread считает только активные тикеты.

## Ownership

| Зона | Владелец |
|------|----------|
| Prisma + migrations + seed | `prisma/` |
| Zod / domain helpers | `src/lib/ved/` |
| Dual writers | Next + `containers/api` |

## Тесты

- Unit: `data-model-d24.test.ts`, `chat.test.ts`, calculations mocks с `calculationEvent`
- CI: `npm run test:ci`
