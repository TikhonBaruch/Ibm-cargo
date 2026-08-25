# Решения (ADR-lite)

## D1. Монетизация MVP

**Решение:** оплата **за просчёт** — Экспресс / Стандарт / Профи.  
Лендинговые «Старт / Бизнес / Enterprise» — маркетинговые плашки до биллинга подписок.

## D2. Регистрация vs калькулятор

**Решение:** на лендинге — демо/превью расчёта без полной обработки брокером; в очередь брокера и PDF — после регистрации и оплаты (как в `КАРГО БРОКЕР.pdf`).

## D3. Канон дизайна

**Решение:** только `docs/design/refs/` + исходники в `new_desing/cabinet/`, `cargo-broker-design/`, `assets/wireframe-…`.  
`cabinet (2)` / `cabinet (3)` — дубликаты экспорта, не править.

## D4. Monorepo / контейнеры

**Решение:** сервисы в `containers/*` + `packages/*` + `docker-compose.yml`.  
Runtime Next пока в корне (Vercel); extract UI в `containers/web` — отдельным шагом.

## D5. AI pipeline

**Решение:** `ClientRequest → containers/ai (draft) → BrokerQueue → BrokerConfirm → ClientResult/PDF`.  
До внедрения моделей — stub HTTP в `containers/ai`.

## D6. Legacy CMS

**Решение:** не расширять posts/portfolio/specialists как лицо продукта. Legacy CMS — только для SUPER_ADMIN на obscure path (credentials только в seed / private ops); VED-операции — `/admin` для ADMIN. Старые `/admin/posts` и т.п. редиректят на obscure CMS routes.

## D7. kargo

**Решение:** `kargo-broker/kargo` — архив версий; работа в репозитории GitHub `TikhonBaruch/taurus` (бренд LBM Брокер).

## D8. Статусная машина Calculation

**Решение:** единая модель статусов (дизайн сводим к одной):

`DRAFT` → `AI_PROCESSING` → `AI_READY` → `AWAITING_PAYMENT` → `QUEUED` → `IN_REVIEW` → `DONE`

Также: `SLA_RISK` (флаг/статус при просрочке SLA), `CANCELLED`.

Экспресс (только AI): после оплаты → сразу `DONE` + PDF (брокер не обязателен).  
Стандарт/Профи или confidence < порога: после оплаты → `QUEUED`.

**Live vs legacy (см. D23 / [`db-process.md`](./db-process.md)):** happy-path writers создают `AI_PROCESSING` → `AI_READY` (не `DRAFT`); `AWAITING_PAYMENT` принимается только на pay, если уже в БД; `CANCELLED` — reserved.

## D9. Лендинг-подписки ≠ биллинг MVP

**Решение:** «Старт / Бизнес / Enterprise» на лендинге — маркетинг. Канон оплаты — **за просчёт** (D1): Экспресс / Стандарт / Профи.

## D10. Лимит позиций

**Решение:** EXPRESS ≤ 1; STANDARD ≤ 3; PRO ≤ 10. Mobile-текст «до 3 в MVP» относится только к Standard.

## D11. Очередь брокера только после оплаты

**Решение:** «Отправить брокеру» без оплаты не ставит в `QUEUED`. Freemium (3 AI без брокера) — исключение на уровне тарифа/квоты, не обход оплаты брокерского тарифа.

## D12. Комиссия платформы

**Решение:** комиссия платформы = `100% − brokerShare`. Отдельное поле в MVP не обязательно.

## D13. Оплата MVP

**Решение:** внутренний баланс компании + `LedgerEntry`. Списание тарифа — charge баланса. Пополнение: mock `creditCompany` (gated `ALLOW_MOCK_TOPUP` / DEMO) или `PAYMENTS_SERVICE_URL` → checkout → webhook TOPUP. ЮKassa — opt-in; durable **`PaymentIntent`** + idempotent `LedgerEntry.paymentIntentId`; webhook verify via payment re-fetch. Эквайринг не меняет pay-тарифа.

## D14. UI кабинетов

**Решение:** продуктовые кабинеты — React `src/components/ved/*Cabinet` + `VedShell`. HTML-порт `CabinetsApp` снят; IA путей — `ADMIN_CABINET_PATHS` / cabinet & broker routes.

**Baseline (отправная точка UI, 2026-08-04):** визуальный паритет с [`cargo-broker-cabinets.html`](../design/refs/cargo-broker-cabinets.html) при живых API. Git tag **`ved-ui-cabinets-baseline`**. Shell full-bleed (тёмный сайдбар к левому краю viewport, без `mx-auto max-w` центрирования всего app). Данные только live — без fake GMV / «1284». Proto-bar переключения ролей — только в HTML-моке, не в проде. Дальнейшие UI-правки — от этой точки (не от удалённого `CabinetsApp` и не от упрощённого MVP-шелла). Канон: [`design.md`](./design.md) → [`design-baseline.md`](./design-baseline.md).

## D15. Три ветви: mapping, preferred broker, logistics quotes

**Решение:**

1. **Таблица сопоставлений** — источник истины по HS/платежам на уровне `CalculationItem` (`hsCodeAi`, `hsCodeFinal`, item duty/VAT). Approve брокера пишет item-level + агрегат calc → PDF.
2. **Preferred broker** — поле `Calculation.preferredBrokerUserId`; при оплате сохраняется; очередь сортирует preferred first; иначе claim; admin assign override. Exclusive window = `ved.preferredClaimHours` (default = SLA); после таймаута claim открыт всем + `SLA_TICK` снимает preferred.
3. **Логистика** — после `DONE`: quotes (stub/demo-3pl via `LOGISTICS_SERVICE_URL` или `buildStubShippingQuotes`) → клиент выбирает схему; tracking обновляет `QUOTED`/`IN_TRANSIT`/`DELIVERED` в UI. Внешний carrier API — growth. **UI «Перевозка»** в кабинете клиента по умолчанию **скрыт** (`shippingUiEnabled` / `NEXT_PUBLIC_SHIPPING_UI`); domain API и `ShippingPane` остаются в коде — включение без удаления (см. [`current-app.md`](./current-app.md), [`roadmap.md`](./roadmap.md) §2.2).
4. **Цены брокера** — правка таможенных платежей (`dutyRub`/`vatRub`/`feeRub`/item), не `TariffPlan.priceRub` (платформа).
5. **Чат** — симметрия client + broker UI на `CALCULATION` threads; вложения — `/api/v1/uploads` + `attachmentUrl`; `waitingOn` CLIENT|BROKER.
6. **Uploads на Vercel** — durable media только через `S3_*` (Yandex Object Storage); без ключей на Vercel `POST /api/v1/uploads` → 503 (read-only FS). Local FS — только non-Vercel.

Карта: [`branches.md`](./branches.md).

## D16. Broker surface extract

**Решение:** кабинет брокера развивается как отдельный Next app в [`containers/broker`](../../containers/broker/) (:3002, gateway `/broker-app/`). Shared UI — `src/components/ved/broker/*`. Domain mutations остаются в Next `/api/v1` до включения `USE_DOMAIN_API=1` → [`containers/api`](../../containers/api/) (`claim` / `approve` / chat / payouts / sla-tick). Auth: общий `NEXTAUTH_SECRET`; login redirect на web.

## D17. Client surface extract

**Решение:** кабинет клиента — отдельный Next app в [`containers/client`](../../containers/client/) (:3003, gateway `/client-app/`). Shared UI — `src/components/ved/client/*` + `ClientCabinet`. API rewrite на web; domain create/pay/shipping/topup/chat — в `containers/api` при `USE_DOMAIN_API=1`. Рабочий UI на Vercel остаётся `/cabinet/*` до полного cutover.

## D18. Stability scaffold

**Решение:** перед growth-фичами (OCR, эквайринг, SMS) обязателен каркас стабильности:

1. KB: [`skeleton.md`](./skeleton.md) + ADR (на момент введения — D1–D17; сейчас канон **D1–D27**, см. этот файл);
2. Агенты: корневой [`AGENTS.md`](../../AGENTS.md) + `.cursor/rules/ved-*.mdc` (зеркало `docs/knowledge/ved-*.mdc`);
3. CI: `scripts/verify-structure.cjs` (`npm run test:structure`) + invariant unit suite + `test:contracts`;
4. Growth / новый функционал не мержится без зелёного `npm run test:ci`.

Каркас сигнализирует о конфликтах ownership, synthetic items, отсутствии docs/D16–D17, Prisma в UI-контейнерах, регрессе покрытия.

## D19. Порядок ответвлений контейнеризации

**Решение:** после D16–D18 следующий extract идёт строго по карте [`containerization.md`](./containerization.md):

1. **C1** Domain API cutover (`containers/api` = источник `/v1/*`) — compose `web` defaults `USE_DOMAIN_API=1`; Vercel unset
2. **C2** Admin Next (замена stub `containers/admin`)
3. **C3** AI real draft
4. **C4** Payments + notify (`scale`)
5. **C5** Slim web / Vercel boundary — последним

Не параллелить C2+C3+C4 в одном PR. Не дробить postgres/redis/gateway как product branches. Не выносить Prisma в broker/client.

Admin Next extract (C2) фиксируется ADR **D20**.

## D20. Admin surface extract

**Решение:** VED-админка — отдельный Next app в [`containers/admin`](../../containers/admin/) (:3001, gateway `/admin-app/`). Shared UI — `AdminVedCabinet` + `VedShell`. API rewrite на web; **без Prisma** в пакете admin. Legacy CMS (posts/gallery/…) остаётся в корневом Next на `/2178737` (D6), не копируется в admin-контейнер. Рабочий UI на Vercel — `/admin/*` (VED) до полного cutover.

## D21. AI draft via containers/ai (C3)

**Решение:** источник draft — `POST containers/ai /v1/draft` (engine `heuristic-v1`). Клиентский код: `src/lib/ved/ai.ts` → `AI_SERVICE_URL`; domain API create тоже вызывает AI. Локальный fallback = тот же heuristic. Optional enrich: `containers/llm` (`LLM_SERVICE_URL`) — stub или OpenAI при `OPENAI_API_KEY`; fail-open. Контракт `/v1/draft` не менять при смене llm provider ([`ai-pipeline.md`](./ai-pipeline.md)).

## D22. Web slim boundary scaffold (C5)

**Решение:** полный slim cutover отложен. Документ [`web-slim.md`](./web-slim.md) + env `WEB_SURFACE=full|slim` (`src/lib/ved/web-surface.ts`). Gate перед cutover: `npm run smoke:gateway`. Пока Vercel и compose web = **full** (кабинеты в корневом Next). Не удалять `/cabinet`/`/broker`/`/admin` без отдельного cutover ADR.

## D23. Очередность DB-процесса заявки

**Решение:** канон порядка обращений к Postgres и инвентарь обязательных моделей/полей — [`db-process.md`](./db-process.md).

1. Мутации статуса только через `assertTransition` / `canTransition` (D8).
2. Pay: ledger charge + смена статуса (`QUEUED`\|`DONE`) в **одной** `$transaction`; повторный pay при уже `paidAt` — идемпотентный no-op без повторного charge (D11/D13).
3. Claim: conditional update `QUEUED`\|`SLA_RISK` → `IN_REVIEW` + assignment + chat thread в одной tx.
4. Create: Phase A (`AI_PROCESSING`+items) → AI out-of-tx → Phase B (item draft fields + `AI_READY`) в одной tx.
5. Mapping / approve calc+PDF — одна tx; `BrokerPayout` — отдельная короткая tx после DONE.
6. `Company` balance под row lock (`FOR UPDATE`) внутри ledger tx.
7. Live path не использует `DRAFT`/`CANCELLED`; `AWAITING_PAYMENT` — legacy accept на pay only.

## D24. Базовая структура данных: товары, ТН ВЭД, история запросов

**Решение:**

1. **Описания товаров** — остаются на `CalculationItem` (D15). Колонки `name` / `description` / qty / price + опциональный JSON `attrs` (материал, состав, бренд, вес, `hsHint`, …). Zod: `src/lib/ved/product-description.ts`. Контракт: [`d-product.calc.json`](../contracts/d-product.calc.json). Отдельной сущности Product catalog в MVP нет.
2. **Справочник ТН ВЭД** — модели `TnvedCode` (дерево 2/4/6/8/10) + `TnvedDutyRate`. PK = только цифры; display — пробелы (`8471 30 000 0`). Хелперы: `src/lib/ved/tnved.ts`. Контракт: [`d-tnved.core.json`](../contracts/d-tnved.core.json). `CalculationItem.tnvedCode` — soft lookup (без FK), пока импорт неполный. Mapping/approve по-прежнему пишет `hsCodeFinal` строкой.
3. **История запросов** — append-only `CalculationEvent` (`CREATED` → `AI_DRAFT` → `PAID` → `CLAIMED` → `ITEM_MAPPED` → `APPROVED`). Статусная машина остаётся на `Calculation.status` (D8). Контракт: [`d-history.calc.json`](../contracts/d-history.calc.json). Admin `AuditLog` не заменяет calc trail.

Импорт полного номенклатурного дерева — follow-up (Track B). HTTP search + UI attrs/events — **done** (polish этап 2 / roadmap §2.5).

**Статус реализации (2026-08-07):** **на `main`** — Prisma schema + migration, domain helpers, dual writers Next + `containers/api`, contracts D-PRODUCT/D-TNVED/D-HISTORY, unit `data-model-d24`, seed heuristic-листьев, search/import API + UI attrs/events. Схема на sweb применена. Канон: [`data-model.md`](./data-model.md). **Follow-up:** полный импорт номенклатуры ТН ВЭД (Track B); ADMIN batch UI `/admin/tnved` — **done** на ветке D28 (2026-08-10). `binaryTargets` включает `linux-musl-openssl-3.0.x` для Alpine compose.

## D25. Публичная регистрация CLIENT (MVP idea-check)

**Контекст:** для проверки идеи нужен новый импортёр без SQL/seed. Брокер остаётся seed/admin (нет публичной регистрации BROKER).

**Решение:**

1. `POST /api/v1/auth/register` в одной `$transaction`: `Company` (name, optional inn, `balanceRub=0`) + `User` (email unique, bcrypt password, role `CLIENT`, `companyId`).
2. UI `/register` → после успеха `signIn` credentials → `/cabinet`.
3. Middleware: путь публичный через `isPublicAuthedPath` + early `next()` для API без сессии (иначе `resolvePathAccess` без role → 401).
4. Деньги: stub/mock topup после login (D13); LLM и live ЮKassa для idea-check **не** нужны.
5. Live gate: `npm run smoke:mvp` (register → topup → create → pay → seed-broker claim/approve).

Код: `src/lib/ved/register.ts`, `app/api/v1/auth/register`, `app/register`. Ops: [`runbook.md`](./runbook.md), [`staging.md`](./staging.md).

## D26. Durable orchestration (jobs / outbox / service calls)

**Контекст:** worker jobs и notify outbox были in-memory; Redis в compose не использовался. Нужны таблицы для оркестрации контейнеров и статусов доставки **без** второго FSM заявки.

**Решение:**

1. **`BackgroundJob`** — очередь worker (`SLA_TICK`, `OUTBOX_DRAIN`, …); статусы `QUEUED|RUNNING|DONE|FAILED|DEAD`.
2. **`ServiceOutbox`** — transactional outbox notify/webhook; статусы `PENDING|SENDING|DELIVERED|FAILED|DEAD`; пишется при approve / SLA / TOPUP.
3. **`ServiceCall`** — журнал вызовов `ai|llm|payments|notify|logistics|worker|api` (`PENDING|OK|FAILED|TIMEOUT`).
4. Product FSM остаётся: `CalculationStatus` (D8), `PaymentIntent`, `ShippingRequest`. Контракт: [`d-orch.core.json`](../contracts/d-orch.core.json); bump D-JOB / D-EVENT v2.
5. Drain: worker → `POST /v1/internal/outbox/drain` + `POST /v1/internal/jobs`; dual-path Next + `containers/api`.
6. Health: `GET /v1/internal/orch/health` — окно `ServiceCall` + probe `/health` deps; payments checkout пишет `ServiceCall` (`OK|FAILED|TIMEOUT`).

Код: `src/lib/ved/orchestration.ts`, `src/lib/ved/orch-health.ts`, migration `20260805160000_service_orchestration`.

## D27. Фокус MVP: частный заказчик (ТН ВЭД → брокер-QC → PDF)

**Контекст:** продукт удобнее позиционировать для частных/SMB импортёров, которые ищут сначала код ТН ВЭД, затем контролёра качества (брокера), затем доставку «под ключ». Внешняя логистика, live-эквайринг и LLM-сопоставление товара без кода — временно не реализуются ([`plan-mvp-polish.md`](./plan-mvp-polish.md)).

**Решение:**

1. **Deliverable MVP** = понятный draft ТН ВЭД + смета → оплата тарифа → брокер как QC → **PDF**. Не продавать «доставку под ключ» как текущий CTA.
2. **AI** = heuristic-v1 (+ attrs D24); Express при высокой confidence; иначе soft-push на STANDARD (брокер). LLM enrich — Growth, fail-open когда появится.
3. **Деньги** = mock/stub topup для idea-check (D13/D25); UI не должен выглядеть как live карта/СБП без ЮKassa host.
4. **Перевозка** = код и API остаются; клиентский shipping UI выключен (`shippingUiEnabled`); «под ключ» — post-PDF этап после реального 3PL.
5. **Копирайт** лендинга/кабинетов под эту воронку — отдельная UI-задача; до явного запроса **не** менять.

Канон narrative: [`product.md`](./product.md) §«Фокус MVP». При правках или пересборке единой KB — сверяться с D27 (см. [`README.md`](./README.md) §Правила обновления KB).  
Стратегические persona (производитель, buyer-groups, master-data габаритов) — **D29** / [`target-client.md`](./target-client.md); не смешивать с текущим CTA.

## D28. ADMIN ops surface + скрытие SUPER

**Контекст:** VED-админ (`/admin`) должен управлять операционным контуром продукта (гейты, платежи, LLM, журнал, пользователи) без доступа к Legacy CMS и без публичной видимости «защитной кнопки» SUPER.

**Решение:**

1. **ADMIN** — полный VED-контур: дашборд / заявки / клиенты / брокеры / тарифы / финансы / support / orch / **tnved** / **integrations** / AI-качество / settings / **users** / **audit**. UI: `AdminVedCabinet` + `ADMIN_CABINET_PATHS`; parity в `containers/admin`.
2. **Feature toggles** (`SiteSetting` / `PLATFORM_SETTING_KEYS`): `marketplaceEnabled`, `autoAssignBrokers`, `maintenanceMode`, **`paymentsEnabled`**, **`llmEnrichEnabled`**, **`notifyEnabled`**, **`mockTopupAllowed`**. Выкл = отказ с понятной ошибкой (pay/topup; LLM → heuristic; notify kick skip). `mockTopupAllowed` **AND** с env `ALLOW_MOCK_TOPUP`. Проводка: `platform-gates.ts` + dual-path `containers/api`.
3. **Интеграции** (`GET /api/v1/platform/integrations`): здоровье **payments / LLM / notify** (masked host из env), санитизированный I/O `ServiceCall`, toggles. **Не** редактировать URL/API keys из ADMIN UI — только env / Vercel (+ SUPER infra panel).
4. **Аудит:** `logAction` / `logLogin` — **no-op** для `SUPER_ADMIN`; API audit фильтрует SUPER rows; PATCH settings аудируется для ADMIN. Pane `/admin/audit` для ADMIN.
5. **Пользователи:** list без `SUPER_ADMIN`; ADMIN может create (роли ≠ SUPER) и reset password; нельзя повысить до SUPER через UI — только seed/SQL. Pane `/admin/users`.
6. **Клиенты / заявки (ops UX):** drill-down компании (`GET company/[id]`) + **ADJUSTMENT** (`POST …/adjust` + audit); карточка calc (items / assign / escalate / **PDF link**) + deep-link `/bookings?id=` / `/clients?company=`; SUPPORT nav unread (`countAdminUnread`).
7. **Брокеры / финансы / orch / ТН ВЭД:** модерация + admin toggle **`acceptingJobs`**; finance фильтр статуса + **CSV**; orch **GET + POST retry** FAILED/DEAD (`retryBackgroundJob` / `retryOutboxMessage` → `OUTBOX_DRAIN`); pane `/admin/tnved` → `POST /api/v1/tnved/import` (batch upsert, не полный Track B dump).
8. **SUPER / obscure path** (D6): Legacy CMS + infra (`SuperInfraPanel`, `GET /api/admin/infra`) только на obscure root; credentials **не** в публичных демо-строках KB/AGENTS/login; login obscure path без email prefill.

Код: `src/lib/ved/{platform-gates,integrations,admin-company,orchestration,super-admin,infra-access,settings,domain,chat}.ts`, `src/lib/audit.ts`, `AdminVedCabinet`. Инвентарь UI: [`cabinets/admin/`](./cabinets/admin/) · ops map: [`admin-ops.md`](./admin-ops.md).

**Статус (2026-08-10):** реализовано на ветке `cursor/admin-ops-harden` (unit `orchestration` retry · `admin-paths` + tnved · `test:ci` green). Merge → `origin/main` / prod — ещё нужен.

## D29. Стратегические persona и сеть (производитель / buyer-groups)

**Контекст:** MVP (**D27**) обслуживает частного/SMB импортёра. Отдельно зафиксирована стратегия: сотрудник производителя, теряющий мелких заказчиков; консолидация «хвоста» в объёмы; эталонные веса/габариты от завода; закрытые группы диалога закупщиков (иначе peer-сеть уйдёт в Telegram).

**Решение:**

1. **Не менять** текущий CTA / deliverable D27 (ТН ВЭД → брокер-QC → PDF). Стратегия живёт в [`target-client.md`](./target-client.md) + этот ADR.
2. **Persona производителя** — косвенный выгодополучатель MVP. Partner surface **v1** (SKU catalog + спрос, инвайт ADMIN, не публичный signup) — после UX кабинетов CLIENT→BROKER→ADMIN; не polish D27 и не текущий CTA. Канон UI: [`cabinets/ux-saas.md`](./cabinets/ux-saas.md) §6. Консолидация / buyer-groups / публичная витрина — Ecosystem.
3. **Master-data:** нетто / брутто уже в `attrs` (`netWeightKg` / `grossWeightKg`); размеры упаковки и транспортные габариты+вес — расширение schema / partner catalog при реализации (см. [`calculation-fields.md`](./calculation-fields.md)).
4. **Buyer closed-groups:** вступление по запросу, добавляет **ADMIN**; отдельный тип треда/группы ≠ `CALCULATION` / `SUPPORT`; UX-формат TBD; не публичный форум; Telegram — возможный notify/mirror позже, не лицо продукта.
5. **Консолидация объёмов** — срез **D34** (qty-запрос → сборный заказ) live в кабинетах; оплата MOQ / отгрузка партии / buyer-groups — по-прежнему Ecosystem.

Канон: [`target-client.md`](./target-client.md). При пересборке KB не смешивать D29 с CTA D27 ([`README.md`](./README.md) §Правила обновления KB).

## D30. Growth OCR / precedent — hold до ключей (compose)

**Контекст:** P2 OCR (text PDF + vision) и precedent-v2 (pgvector) реализованы частично на compose/local. Prod CTA остаётся D27; vision и embed — opt-in Growth.

**Решение:**

1. **Text PDF import** — **done** (`parseProductPdf`, `smoke:pdf-import`); не блокируется ключом.
2. **Vision OCR (`imageBase64`)** — engine `ocr-vision-v1` в `containers/ocr`; **hold E2E** до стабильного `OPENAI_API_KEY` + `OCR_VISION_MODEL` (image-capable, ≠ `LLM_CLASSIFY_MODEL`) на сервисе `ocr`. Без ключа — fail-open / stub; Vercel без `OCR_SERVICE_URL` — skip (норма).
3. **Приоритет wire после ключа:** **OCR-A** (фото invoice → import preview + `extract-table`) → **OCR-B** (фото товара → create attrs). Не продвигать vision в лендинг/CTA до зелёного `smoke:ocr-vision` на staging.
4. **Precedent-v2 (pgvector):** схема + domain готовы; **hold live** до `pgvector/pgvector` на compose Postgres + embed key (`PRECEDENT_EMBED_MODEL`). До этого — lexical `precedent-v1` (fail-open).
5. **Multi-LLM router** (Kimi / DeepSeek) — отдельный hold; не смешивать с OCR vision gate.
6. **Мониторинг спринта:** `npm run test:ci` + smokes по [`testing-branches.md`](./testing-branches.md) §Growth local; планы — [`plan-ocr-vision.md`](./plan-ocr-vision.md), [`plan-precedent-bulk.md`](./plan-precedent-bulk.md).

**Статус (2026-08-12):** hold зафиксирован; канон спринтов — [`plan-ocr-vision.md`](./plan-ocr-vision.md) · [`plan-precedent-bulk.md`](./plan-precedent-bulk.md).

## D32. UI: сначала общепризнанные решения

**Контекст:** кабинеты легко обрастают одноразовыми кнопками, вторым тостом и «уникальными» экранами. Пользователь должен узнавать привычное SaaS-поведение; D14 задаёт токены, но не запрещает изобретать паттерн.

**Решение:** любая реализация UI (экраны, nav, empty, формы, модалки, таблицы, Cmd+K, настройки) идёт в порядке: (1) паттерны репозитория → (2) NN / WCAG / HIG·Material·Fluent / SaaS → (3) Linear/Stripe/GitHub как паттерн, не пиксель → (4) кастом только с записью «какой стандарт не подошёл и почему». Не плодить второй shell/toast/drawer. Cmd+K и прочие сознательные пробелы — только по [`design-parity.md`](./design-parity.md).

Канон: [`design-patterns.md`](./design-patterns.md) · правило [`ved-ui-patterns.mdc`](./ved-ui-patterns.mdc).

## D33. Цикл фичи обязателен (план → код → KB)

**Контекст:** агенты и PR часто начинают с кода, а документация и деплой-ограничения Hobby догоняют потом. Это ломает dual-path, Vercel build и единую базу.

**Решение:** любая идея и сборка идут только по циклу: **идея → анализ → структурирование (обязательный план) → реализация → проверка → анализ → правка при багах → деплой с учётом бесплатного Vercel → запись в единую базу**. Без плана в `docs/knowledge/` код не писать. Без записи в KB задачу не закрывать. Деплой: merge `main` → Vercel Hobby; `prisma generate` в build, migrate на БД отдельно; не `WEB_SURFACE=slim`; не плодить второй Postgres на Hobby.

Канон: [`feature-cycle.md`](./feature-cycle.md) · правило [`ved-feature-cycle.mdc`](./ved-feature-cycle.mdc) · [`deploy.md`](./deploy.md).

## D34. Сборный заказ завода + сегменты клиента

**Контекст:** D29 держал консолидацию в Ecosystem. Кабинет производителя v1 (D31) отдаёт эталон SKU и спрос без ПДн, но завод не может подтвердить хвост в партию. У импортёра три рабочих режима (розница / единичные / опт), которые нельзя решать тремя `UserRole`.

**Решение:**

1. **Сегмент** — `Company.clientSegment`: `SINGLE` (default) · `RETAIL_SMALL` · `WHOLESALE`. Роль остаётся `CLIENT` (D25). Не три кабинета и не публичный signup завода.
2. **Сборный заказ** — отдельные сущности `SkuOrderRequest` / `SkuOrderPool`, **не** статусы D8 на `Calculation`. Клиент шлёт qty к PUBLISHED SKU; завод принимает в OPEN пул или отклоняет; «Подтвердить сборку» → `CONFIRMED`.
3. **ПДн:** клиент видит только свой запрос + агрегат qty пула; завод видит название/ИНН компании-заказчика (B2B), не email пользователей. Спрос (`/demand`) остаётся агрегатом без CRM.
4. **Не в этом ADR:** маркетплейс, оплата MOQ заводу, отгрузка сборной партии, buyer-groups, замена CTA D27 (`/cabinet/new`).

Канон: [`plan-consolidate-orders.md`](./plan-consolidate-orders.md) · [`cabinets/manufacturer/`](./cabinets/manufacturer/).

**Статус (2026-08-14):** v1 live: `Company.clientSegment` + `SkuOrderRequest`/`SkuOrderPool` + `/cabinet/factory` + `/manufacturer/pools`. Dual-path `sku-order.ts` / `sku-orders.js`.

## D35. Параллельная ownership + model ≠ container

**Контекст:** для параллельной разработки нужно явное владение пакетами; риск — плодить Docker на каждый vendor LLM.

**Решение:**

1. **Пакеты** — logical `domain` / `orch` / `mesh` / `draft` в [`src/lib/ved/PACKAGES.md`](../../src/lib/ved/PACKAGES.md); UI — `containers/{client,broker,admin,manufacturer}` + panes. Один PR ≈ один пакет (+ dual-path api при domain writers).
2. **Канон AI HTTP** — репо `llm` (`services/classification`, `services/ocr`). Taurus `containers/llm|ocr` = Compose mirrors; `npm run sync:ai-matrix` или `LLM_DOCKER_CONTEXT` / `OCR_DOCKER_CONTEXT`.
3. **Model ≠ container** — новая модель = env profile + optional chain (`LLM_CLASSIFY_CHAIN`). Новая **capability** = новый сервис в matrix + ADR + `*_SERVICE_URL`.
4. Не дробить postgres/redis/gateway (D19). UI не зовёт matrix URL.

Канон: [`plan-parallel-ownership.md`](./plan-parallel-ownership.md) · [`ved-ownership.mdc`](./ved-ownership.mdc) · [`containerization.md`](./containerization.md).


