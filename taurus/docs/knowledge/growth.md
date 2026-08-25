# Growth / фаза E

Заготовки после MVP (фазы A–D).  
Envelopes не менять при смене провайдера — только env внутри контейнера.

Стратегический горизонт (persona производителя, master-data габаритов, консолидация, **закрытые группы закупщиков**): [`target-client.md`](./target-client.md) · ADR **D29** — не смешивать с CTA D27.  
Кабинет производителя **v1** (SKU + спрос, после UX трёх кабинетов): [`cabinets/ux-saas.md`](./cabinets/ux-saas.md) §6.

## Env opt-in (кратко)

| Сервис | Включить | Поведение без ключей |
|--------|----------|----------------------|
| `llm` | `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL`, `LLM_CLASSIFY_MODEL`) или `LLM_PROVIDER` + `DEEPSEEK_*` / `QWEN_*` | `llm-stub-v0` |
| `payments` | `YOOKASSA_SHOP_ID` + `YOOKASSA_SECRET_KEY` | stub auto-confirm → webhook TOPUP |
| `notify` | `RESEND_API_KEY` или `SMTP_URL` (`smtps://…`) | email **не** fake-DELIVERED (queued/FAILED); SMS/push stub |
| `logistics` | `LOGISTICS_PROVIDER=demo\|stub` (default **demo**) | demo-3pl CDEK-shaped / stub formula |

Compose: profile `scale`/`full`; см. `docker.env.example`.

## Перевозка

Модель `ShippingRequest` и API `GET/POST /api/v1/shipping` уже есть (D15: только после `DONE`).  
Logistics: [`containers/logistics`](../../containers/logistics/) — quotes + tracking; Domain/Next: `LOGISTICS_SERVICE_URL`; иначе `buildStubShippingQuotes`.

**Клиентский UI** («Перевозка» в nav, блок на дашборде, `ShippingPane`) **собран, но выключен** флагом `shippingUiEnabled` (`src/lib/ved/cabinet-features.ts`):

| Env | Эффект |
|-----|--------|
| (default) / `0` | пункт меню и pane скрыты; `/cabinet/shipping` → дашборд; API не дергается из кабинета |
| `NEXT_PUBLIC_SHIPPING_UI=1` или `SHIPPING_UI=1` | полный UI котировок / трекинга |

Код и route **не удалять** — go-live = env. **Hold (D27):** не ставить `NEXT_PUBLIC_SHIPPING_UI=1` на prod как текущий CTA. См. [`current-app.md`](./current-app.md), [`roadmap.md`](./roadmap.md) §2.2.  
Дальше growth: внешний carrier API (реальный CDEK и т.п.) за тем же `/v1/quotes` + `/v1/tracking`.

**Инкотермс / базис поставки:** комментарии ICC и инвентарь источников — [`incoterms.md`](./incoterms.md). Не смешивать с CTA «под ключ»; полный текст правил/Guide — IP ICC (без scrape).

## Эквайринг / СБП

[`containers/payments`](../../containers/payments/) — `POST /v1/checkout` → webhook TOPUP (`d-ledger.json` v2).  
Durable **`PaymentIntent`** в Postgres (создаёт domain до checkout).  
- `method=stub` (или без ЮKassa): auto-confirm → TOPUP.  
- `card`/`sbp`/`yookassa` + ключи: pending + `confirmUrl`; `POST /v1/webhooks/yookassa` (Basic + re-fetch payment) → domain TOPUP.  
Идемпотентность: `LedgerEntry.paymentIntentId` unique.  
Клиент: `PAYMENTS_SERVICE_URL` → checkout; иначе mock `creditCompany` при `ALLOW_MOCK_TOPUP` / DEMO (D13).  
**Track A1:** пока нет `PAYMENTS_SERVICE_URL` + ЮKassa на host — оставлять `ALLOW_MOCK_TOPUP` на prod; снимать только после live smoke. Gate: `npm run ops:track-a -- --vercel`.  
Списание тарифа при pay **не** меняется.  
Smoke: `npm run smoke:payments`. Runbook: [`runbook.md`](./runbook.md).

## Notify (D-EVENT)

[`containers/notify`](../../containers/notify/) — `POST /v1/send`, templates из `d-event.notify.json`:  
`generic` | `calc.approved` | `calc.sla_risk` | `ledger.topup`.  
Emitters (api + Next `calculations.ts`) шлют контрактные имена; legacy aliases нормализуются в notify.  
`to`: email (резолв userId/companyId → email на стороне api).  
Дальше: SMS/push каналы без новых business templates.

## Mobile

Референс и прототип: [`design-interactive.md`](./design-interactive.md) · `docs/design/refs/wireframe-cargo-broker-mobile.html`.

## Реальный AI

Сейчас: **heuristic-v1** в `containers/ai` + `src/lib/ved/ai-draft-engine.ts` (C3/D21).  
LLM: [`containers/llm`](../../containers/llm/) — **lookup-v1** (corpus `codes.jsonl`) + optional OpenAI-compatible rerank; enrich через `LLM_SERVICE_URL` + gate `llmEnrichEnabled`; fail-open.  
Контракт `/v1/draft` не меняется ([`ai-pipeline.md`](./ai-pipeline.md)).  
Целевой позвоночник (распределение пакета, не замена брокера): [`plan-ai-mesh.md`](./plan-ai-mesh.md).

**Статус roadmap §3.3 (2026-08-12): partial — compose/local staging**

| Done (backend) | Hold (не CTA / prod) |
|--------------|----------------------|
| corpus lookup-v1, duty from leaf, VAT 22% + ПП 1637 | client TN VED picker / «LLM без кода» |
| `smoke:chain-llm` E2E | Vercel corpus mount |
| **precedent-v1/v2 + CSV/XLSX/PDF preview** (compose/local) | vision `imageBase64` E2E · multi-LLM router |
| Client UI CSV/XLSX bulk (`ProductCsvImport`) + broker reclassify | client TN VED picker / «LLM без кода» |
| русский prompt/disclaimer в classify | prod marketing LLM-as-matcher |

Справочник ТН ВЭД в Postgres (D24): `TnvedCode` + search/import API — [`data-model.md`](./data-model.md) §2.  
Broker autocomplete = **DB layer** (§2.1); AI enrich = **corpus layer**; repeat products = **precedent layer** (§2.2) — [`plan-precedent-bulk.md`](./plan-precedent-bulk.md).

## OCR / docs (P2)

Канон плана и спринтов: [`plan-ocr-vision.md`](./plan-ocr-vision.md).

Vision: AI OCR в [`product.md`](./product.md). Контейнер **`containers/ocr`** (:4700), profile `scale`/`full`:

- `POST /v1/extract` → structured `attrs` + confidence; envelope `d-ocr.ai.json`;
- `POST /v1/extract-table` → line items / headers+rows из text-layer PDF (`ocr-pdf-table-v1`) или vision (`ocr-vision-v1`);
- **wired** fail-open в `createAndDraftCalculation` при `OCR_SERVICE_URL` + item `mediaUrl` (client attrs win);
- Import preview: local `parseProductPdf` (unpdf) → fallback OCR extract-table; UI `.pdf` в `ProductCsvImport`;
- **`imageBase64` + vision** — реализовано в OCR-сервисе; **hold** до `OPENAI_API_KEY` + wire UI/domain (см. план);
- `ServiceCall.service=ocr`; orch health probe.

Engines: `ocr-pdf-text-v1` · `ocr-pdf-table-v1` · `ocr-vision-v1` (**needs** `OPENAI_API_KEY` + image/*) · `ocr-stub-v0`.

Без `OCR_SERVICE_URL` create не вызывает OCR (Vercel default); text PDF preview работает локально без vision.  
Smoke: `smoke:pdf-import` · `smoke:csv-import`. Vision smoke — **TODO** (`smoke:ocr-vision`, skip без ключа).

## Extract containers

Порядок ответвлений: [`containerization.md`](./containerization.md) (C1→C5).

| Шаг | Фокус | Статус |
|-----|--------|--------|
| — | Broker / client UI | **готово** D16/D17 |
| C1 | Domain API cutover | compose default `USE_DOMAIN_API=1` |
| C2 | Admin Next | **готово** D20 |
| C3 | AI draft | **готово** heuristic-v1 ± optional OpenAI llm |
| C4 | Payments + notify | **готово** envelopes + opt-in ЮKassa / email |
| C5 | Slim web | scaffold + `smoke:gateway` ([`web-slim.md`](./web-slim.md), D22) — нужен Docker |
| — | **Depth P1a** | **done** (orch UI, gates, notify inline/Resend path) |
| — | **Depth P1b** | LLM enrich в Next (`LLM_SERVICE_URL`); logistics demo; payments host = ops keys |
| — | **OCR P2** | text PDF **done**; vision `imageBase64` **hold** (ключ + UI) · [`plan-ocr-vision.md`](./plan-ocr-vision.md) |

Таблицы сервисов: [`monorepo.md`](./monorepo.md). Рекомендации «что добавлять»: [`../../containers/README.md`](../../containers/README.md).
