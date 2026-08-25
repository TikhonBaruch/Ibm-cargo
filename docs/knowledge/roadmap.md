# Дорожная карта LBM Брокер

Живой план работ. As-is: [`current-app.md`](./current-app.md). Growth: [`growth.md`](./growth.md).  
Среды: [`environments.md`](./environments.md) · [`staging.md`](./staging.md).  
**Исполняемый план MVP polish (без логистики / LLM / эквайринга):** [`plan-mvp-polish.md`](./plan-mvp-polish.md)  
**Цикл любой фичи + ближайшие этапы M0–G:** [`feature-cycle.md`](./feature-cycle.md)  
**Post-polish P0 (деньги / notify / demo ADMIN):** [`plan-track-a-p0.md`](./plan-track-a-p0.md)  
**Техдолг / hardening (аудит 2026-08-12):** [`plan-tech-debt.md`](./plan-tech-debt.md)  
**ADMIN ops (D28):** [`admin-ops.md`](./admin-ops.md)  
Фокус частник (**D27**): ТН ВЭД → брокер-QC → PDF — [`product.md`](./product.md).
(внутри polish — **матрица приоритизации фич** Impact × Effort + MoSCoW).

## Фаза 1 — Стабилизация

| # | Задача | Статус |
|---|--------|--------|
| 1.1 | Design-KB split (`design-baseline` / `interactive` / `parity`) + интерактивные HTML-рефы | **done** (на `main`) |
| 1.2 | Карта сред `environments.md` + runbook/deploy sync | **done** (на `main`) |
| 1.3 | Public signup `/register` + `POST /api/v1/auth/register` + `smoke:mvp` | **done** — **D25**; задеплоено на prod; smoke PASS ([`staging.md`](./staging.md)) |
| 1.4 | Payments stub/mock + `smoke:payments` на prod | **done** (`ALLOW_MOCK_TOPUP` + S3 uploads + webhook path) |
| 1.5 | Staging/preview playbook + обновлённые prod smoke-результаты | **done** ([`staging.md`](./staging.md); Preview env = зеркало prod включая `S3_*`) |
| 1.6 | UI parity: список тредов чата (брокер) + DevEx `npm run setup` / `.nvmrc` | **done** — merge `feat/chat-threads-devex` · план этап **1A** |
| 1.7 | D24 (attrs / TnvedCode / CalculationEvent) | **done** на `main` + prod smoke mvp PASS · план этап **0** |

## Фаза 2 — MVP polish

Пошагово: [`plan-mvp-polish.md`](./plan-mvp-polish.md).  
**В скоупе исполнения:** §2.1, §2.3, §2.4, §2.5 (+ notify §3.2).  
**Вне скоупа плана:** §2.2 shipping UI, §3.1 ЮKassa host, §3.3 LLM, §3.4 CDEK.

| # | Задача | Документ / этап плана |
|---|--------|------------------------|
| 2.1 | Merge `feat/chat-threads-devex` (chat threads + setup) | **done** · план **1A** |
| 2.2 | Shipping UI go-live (`NEXT_PUBLIC_SHIPPING_UI=1`) | **вне скоупа** текущего плана · [`growth.md`](./growth.md) §Перевозка |
| 2.3 | Support/settings panes (не placeholder) | **done** · план **1B** |
| 2.3b | Client polish: settings→profile, deep-link, dual unread, SUPPORT read, compact topup | **done** · [`cabinets/client/`](./cabinets/client/) |
| 2.4 | SLA bars, thumbs `mediaUrl`, admin escalate | **done** · план **1C** |
| 2.4b | Broker ops: unread badge, work attrs, soft refresh, broker escalate | **done** · [`cabinets/broker/`](./cabinets/broker/) |
| 2.5 | TN VED search/import + UI attrs/events | **done** (2A–2D) · [`data-model.md`](./data-model.md) |
| 2.6 | UX gaps D27: PDF в карточке, list pay CTA, SUPPORT inbox, settings enforcement | **done** · [`cabinets/shared/correctness.md`](./cabinets/shared/correctness.md) |
| 2.7 | Dual-path checklist + notify runbook (F17/F19) | **done** (код/docs) · [`dual-path-parity.md`](./dual-path-parity.md); prod Resend/SMTP keys — ops |
| 2.8 | Admin orch UI + OCR scaffold (P1a leftover / P2) | **done** scaffold · `/admin/orch`, `containers/ocr` |

## Фаза 3 — Growth (фаза E)

Контейнерные приоритеты P1–P3: [`../containers.md`](../containers.md), [`growth.md`](./growth.md) §OCR.

| # | Задача | Envelope | В плане polish? |
|---|--------|----------|-----------------|
| 3.1 | Payments host на prod (ЮKassa) | D-LEDGER | **нет** (вне скоупа) · P1b |
| 3.2 | Notify email prod | D-EVENT | runbook **done**; keys на host — **ops** · P1a |
| 3.3 | LLM enrich staging | D-DRAFT | **partial — compose/local** (lookup-v1 + precedent-v1 + smoke:chain-llm / smoke:precedent-csv); prod CTA hold · P1b |
| 3.4 | Logistics CDEK API | D-SHIP | **нет** · P1b |
| 3.5 | Mobile product (после wireframe) | [`design-interactive.md`](./design-interactive.md) | **нет** (vision) |
| 3.6 | OCR / docs-ingest | `d-ocr.ai.json` | **partial** — text PDF import + extract-table **done**; vision `imageBase64` **hold** (API в ocr, нет UI; ждём `OPENAI_API_KEY`) · [`plan-ocr-vision.md`](./plan-ocr-vision.md) |
| 3.7 | Admin orch UI (Jobs/Outbox) | D-ORCH | **done** `/admin/orch` · P1a |

## Фаза 4 — Инфра C5

Cutover slim web только после стабильного `smoke:gateway` и отдельного ADR ([`web-slim.md`](./web-slim.md), D22).  
В плане polish — только gate/checklist (**этап 4**), не cutover. Checklist: [`dual-path-parity.md`](./dual-path-parity.md).

---

## Post-polish очередь (после кода polish)

Канон исполнения совпадал с очередью «оставшиеся шаги» (ops → polish хвост → UX D27 → Growth). Статус кода на `main`:

| # | Шаг | Статус |
|---|-----|--------|
| 0 | Commit/push D26+D27 + polish UX | **done** на `origin/main` |
| 0b | sweb migrate orch + `S3_OBJECT_ACL` + prod `smoke:mvp`/`full` | schema **synced**; `S3_OBJECT_ACL` on Vercel; prod smoke **PASS** 2026-08-06/07 ([`staging.md`](./staging.md)) |
| 1 | Notify Resend/SMTP keys на host | Track A2 · `SMTP_FROM` on Vercel; **нужен `RESEND_API_KEY`** (оператор) · drain без fake DELIVERED · `npm run ops:track-a` · [`plan-track-a-p0.md`](./plan-track-a-p0.md) |
| 1b | Demo `operator@` / `admin@` = ADMIN; SUPER obscure | Track A3 · **done** · [`plan-track-a-p0.md`](./plan-track-a-p0.md) |
| 1c | ADMIN ops harden (toggles / integrations / hide SUPER) | **D28** · **done** на `main` (merge PR #1, 2026-08-12) · [`admin-ops.md`](./admin-ops.md) |
| 1d | Landing CTAs → `/login`/`/register` + notify без fake DELIVERED + `ops:track-a` | **done** на `main` |
| 1e | F21 broker presence/rating footer | **done** на `main` · [`design-parity.md`](./design-parity.md) |
| 1f | Broker ops: unread chat badge, attrs on work, soft refresh, escalate own IN_REVIEW | **done** на `main` · [`cabinets/broker/`](./cabinets/broker/) |
| 1g | ADMIN cabinet UX: client drill-down/ADJUSTMENT, calc `?id=`+PDF, support badge, notify card, users create/reset | **done** на `main` · [`admin-ops.md`](./admin-ops.md) |
| 1h | ADMIN ops P1: `/tnved` import UI, finance filter+CSV, orch retry FAILED/DEAD, broker acceptingJobs PATCH | **done** на `main` · D28 §7 |
| 1i | Tech-debt hardening: migrate БД-2 sweb, lint Next 16, tsc gate | **done** (tsc/PROTECTED/dual-path docs 2026-08-25) · Track A keys — ops · [`plan-tech-debt.md`](./plan-tech-debt.md) |
| 1j | Post-merge prod smoke + cabinet pack live | **done** 2026-08-12 · `smoke:mvp`/`full` PASS (#47855/#47856) · [`staging.md`](./staging.md) |
| 1k | Cabinet UX: empty states → broker queue honesty → grouped admin nav | **live** (partner v1 — после) · [`cabinets/ux-saas.md`](./cabinets/ux-saas.md) · M0.3 / M1.0–M1.c |
| 2 | UX PDF / pay CTA / support / gates / unread / autoAssign | **done** |
| 2b | Client polish: settings→profile, deep-link, dual badges, SUPPORT read, compact topup | **done** · [`cabinets/client/`](./cabinets/client/) |
| 3 | Dual-path docs + gateway gate | checklist **done**; `smoke:gateway` **PASS** 2026-08-07 |
| 4 | Growth P1b: ЮKassa / LLM / logistics | Track A1 = ЮKassa · LLM **partial** (lookup-v1 + **precedent-v1** + CSV preview API compose/local); [`plan-precedent-bulk.md`](./plan-precedent-bulk.md) · logistics demo ready; shipping UI flag off · [`plan-track-a-p0.md`](./plan-track-a-p0.md) |
| 5 | OCR wire | **partial** — fail-open create + text PDF import (`smoke:pdf-import`); vision hold · [`plan-ocr-vision.md`](./plan-ocr-vision.md) |
| 6 | `smoke:gateway` | **PASS** 2026-08-07 local `:8080` (compose full + seed); gate для C5 cutover |

Явно **не** в текущем MVP (D27) — **hold, не включать на prod как CTA**:

- полный импорт/каталог `TnvedCode` (seed + partial search достаточно; брокер вводит HS вручную)
- `NEXT_PUBLIC_SHIPPING_UI=1` (shipping UI go-live)
- live эквайринг как обязательный путь (mock OK до A1; после ЮKassa — снять mock)
- LLM «без кода» / LLM-as-matcher CTA (`LLM_SERVICE_URL` только opt-in)
- `WEB_SURFACE=slim` / C5 cutover без ADR
- mobile/AI Risk/freemium, новые UI/infra контейнеры (D19)

Матрица полей и attrs soft-policy: [`calculation-fields.md`](./calculation-fields.md). Лендинг D27: [`product.md`](./product.md).  
Проверка env holds + Track A keys: `npm run ops:track-a -- --vercel`

---

## Ближайший план (после MVP-скелета на prod)

Канон процесса фичи: [`feature-cycle.md`](./feature-cycle.md) (этапы **M0–M3**, Growth **G**).

| Этап | Фокус | Статус |
|------|-------|--------|
| **M0** | Эксплуатация: mock+S3, визуальный C↔B↔A, empty states (клиент сначала) | **M0.1+M0.2 PASS** (2026-08-25); empty states live · [`staging.md`](./staging.md) |
| **M1** | Кабинеты: клиент empty → брокер queue/`acceptingJobs` → админ группы nav (**live**); HS heuristic; `smoke:client` | **live** · smoke:client accepts IN_REVIEW (autoAssign) |
| **M2** | Tech-debt (lint/tsc/PROTECTED/docs) + нарезка Admin panes после групп nav | **done** (код) · Track A keys — ops · [`plan-tech-debt.md`](./plan-tech-debt.md) |
| **M3** | Опц. Resend + накопление precedent-v1 | ops / approve |
| **G** | ЮKassa / LLM / ТН ВЭД dump / shipping / OCR / C5; **производитель v1** после M1 кабинетов | hold — не смешивать с M0; не CTA D27 |

Правило: пока M0.1–M0.3 красные, не начинать G в том же PR. Command palette — hold.

---

## Риски и зависимости

| Риск | Влияние | Митигация | Владелец |
|------|---------|-----------|----------|
| **Dual domain** (Prisma in Next vs `containers/api`) | Расхождение prod/compose | `domain-api.test`; один PR = один контейнер | Ядро |
| **Нет долгоживущего staging** | Smoke на prod/preview | Vercel Preview + `TEST_API_URL`; compose `docker:full` | Ops |
| **Payments вне Vercel** | Real topup без внешнего host | До cutover — `ALLOW_MOCK_TOPUP` (внешний узел = growth) | Growth |
| **Schema drift prod** | 500 после деплоя | `prisma migrate deploy` / `db push` на sweb; smoke после merge ([`staging.md`](./staging.md)) · БД-2: [`plan-tech-debt.md`](./plan-tech-debt.md) шаг 1 | Ops |
| **pgvector на sweb** | `migrate deploy` падает / нет `precedent-v2` | embeddings migration fail-open; vector только compose (`pgvector/pgvector`) · lexical OK | Ядро |
| **Preview DB = prod DB** | Тестовые signup/topup в prod | Отдельная preview-БД или осознанный demo-flag | Ops |
| **Dual writers D24** (Next vs `containers/api`) | Расхождение events/attrs | Держать parity в обоих путях; unit + compose smoke | Ядро |
| **C5 cutover рано** | Auth/cookies | Gate: `smoke:gateway`; ADR; не удалять `/cabinet` | Infra |

### Зависимости (порядок исполнения плана)

```text
test:ci green → smoke preview/prod
0 push/deploy D24
  → 1A chat → 1B support/settings ║ 1C SLA/thumbs
  → 2 TN VED/attrs/events UI
  → 3 notify email
  → 4 dual-path / C5 gate (не блокер)
(вне плана: shipping UI · ЮKassa host · LLM · CDEK)
```

### Не блокируют релиз MVP

- Mobile app, OCR, AI Risk, freemium-квоты, подписки лендинга
- Логистика UI / внешний carrier / LLM / ЮKassa host
- Полный AJV contracts, live same-seed api parity stand
- Авто-migrate на Vercel build
