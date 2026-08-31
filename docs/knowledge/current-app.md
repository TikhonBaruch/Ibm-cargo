# Текущее приложение (as-is)

Репозиторий: `Ibm-cargo (this repo)` — Next.js App Router + Prisma + NextAuth + Telegram.

Единая KB: [`README.md`](./README.md) · каркас: [`skeleton.md`](./skeleton.md) · ADR: [`decisions.md`](./decisions.md) D1–D37.  
План / smoke: [`roadmap.md`](./roadmap.md) · [`staging.md`](./staging.md).  
Фокус MVP (D27): ТН ВЭД → брокер-QC → PDF; без logistics/LLM/ЮKassa в текущем CTA — [`product.md`](./product.md).  
Стратегия persona / сеть (D29): [`target-client.md`](./target-client.md).  
ADMIN ops (D28): [`admin-ops.md`](./admin-ops.md).

## Карта

```
app/                      # Next pages + /api/v1 (Vercel)
src/lib/ved/              # Domain orchestration + pure helpers
src/components/ved/       # Cabinets (единственный источник UI; Docker COPY)
src/components/ved/client # Client panes (D17)
src/components/ved/broker # Broker panes (D16)
prisma/                   # CMS + VED
containers/               # 14 сервисов: infra + api/ai/worker + C4 + UI; инвентарь → docs/containers.md
docs/knowledge/           # ADR, branches, skeleton, testing, ops
```

## MVP idea-check (канон потока)

Минимальный путь проверки идеи **без** LLM и live-эквайринга (D25):

1. `/register` → строки `companies` + `users` (CLIENT, balance 0).
2. Login → кабинет клиента.
3. Upload картинки (`S3_*` на Vercel) → `mediaUrl`; create calc → `AI_READY` (heuristic-v1).
4. Topup stub/mock → `LedgerEntry` TOPUP; balance↑.
5. Pay → TARIFF_CHARGE + `QUEUED` (STANDARD) или `DONE` (EXPRESS high conf).
6. Seed-брокер claim → `IN_REVIEW`; approve → `DONE` + `pdfHtml`.
7. Клиент видит статус и PDF из тех же полей Postgres.

Live smoke: `TEST_API_URL=<preview-ibm-cargo-url> npm run smoke:mvp` (не taurus — **D37** backup). Этот репозиторий: Preview URL проекта `ibm-cargo`, не `ibm-cargo.vercel.app`.

### Автономия вне taurus (D36)

MVP D27 **не** требует sibling / nested `./llm`: draft = heuristic (+ opt-in HTTP fail-open).  
**Нулевая связка:** нет sync/mount/build из `./llm`; `containers/{llm,ocr}` LBM-owned.  
Проверка 2026-08-25: `test:ci` · `smoke:mvp` #47935 · `smoke:payments`. Канон: [`plan-zero-llm-coupling.md`](./plan-zero-llm-coupling.md) · [`plan-autonomy-outside-taurus.md`](./plan-autonomy-outside-taurus.md).

## Живое (VED + ветви 1–2)

- Роли `CLIENT` / `BROKER` / `MANUFACTURER` + staff; вход `/login`, **регистрация импортёра** `/register` (`POST /api/v1/auth/register` — Company + User CLIENT в одной tx; брокер и производитель только seed/admin) — **D25** / **D31**
- Domain API `/api/v1/*` (session) ↔ `containers/api` при `USE_DOMAIN_API=1`: create/items, pay + preferred, claim/approve/escalate mapping, assign, PDF, chat (+threads/unread), shipping after DONE, tariffs, company/topup, payouts, settings, brokers/me, SLA tick
- Flow: просчёт → AI **heuristic-v1** → оплата с баланса (± preferred / ЮKassa TOPUP via `PaymentIntent`) → QUEUED или DONE → mapping брокера → PDF
- Surfaces: CLIENT home **`/cabinet`** (product-shell, `/api/v1`) + lab `/client` (demo-store, референс); `/broker` + `/admin` (VED D28 ops-shell) + `/manufacturer`; client `/factory` и manufacturer `/pools` живы в коде, но могут быть скрыты feature-flag по D27/D34; Legacy CMS — obscure SUPER path (D6); extract Next `containers/client:3003`, `broker:3002`, `admin:3001`, `manufacturer:3004`
- **UI baseline:** parity с `cargo-broker-cabinets.html` + live API (D14) — [`design-baseline.md`](./design-baseline.md) · интерактив · [`design-interactive.md`](./design-interactive.md)
- **Live chrome lbm-bro:** `/cabinet` 5 тайлов + поиск/колокол + superapp; `/cabinet/new` шаг «Что ввозите?» (C10–C12) + C16 порядок полей как lab; заявка = страница `/cabinet/orders/[id]` (C15); список заявок — чипы lab (C16); `/cabinet/tnved` карточка как lab при `GET /api/v1/tnved` (C17) + каталог lab в Postgres (C18); inner panes C4 = `.card` / `table.data` / `.field` / `.chat-box`; `DesignerStub` не рисует бейдж (C9); chrome производителя скрыт (C6) · `/broker` `/admin` ops-shell · lab `/client` референс · [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md) · [`plan-lbm-bro-max-match.md`](./plan-lbm-bro-max-match.md) · [`plan-lbm-bro-tnved-dir.md`](./plan-lbm-bro-tnved-dir.md) · [`plan-lbm-bro-tnved-catalog.md`](./plan-lbm-bro-tnved-catalog.md)
- **C1** Compose ready / **Vercel dual** (Prisma-in-Next); **C2–C4** done as designed (opt-in providers). **C5** scaffold + `smoke:gateway` (D22)
- Ops: [`runbook.md`](./runbook.md) · среды: [`environments.md`](./environments.md) · DB process: [`db-process.md`](./db-process.md) (D23) · MVP smoke: `npm run smoke:mvp`
- Демо на `/login`: `client@example.com` / `broker@example.com` / `admin@example.com` · `demo1234`. Obscure SUPER path/email в клиентском коде закодированы; seed-пароль SUPER не менялся; `robots.txt` без карты obscure-путей. План: [`plan-public-surface-hygiene.md`](./plan-public-surface-hygiene.md).

## Интегрированные решения (на `main` / prod)

Сводка того, что **собрано и работает** в продакшен-ветке (не vision). Детали ADR — в [`decisions.md`](./decisions.md).

| Решение | Где | Проверка |
|---------|-----|----------|
| Public CLIENT signup (**D25**) | `/register`, `src/lib/ved/register.ts`, `POST /api/v1/auth/register`, middleware `isPublicAuthedPath` + early API `next()` | `smoke:mvp` на prod **PASS** (2026-08-05) |
| Pay / topup (D13) | баланс + `LedgerEntry` + `PaymentIntent`; mock/`stub` при `ALLOW_MOCK_TOPUP`; webhook `POST /api/v1/webhooks/payments` | `smoke:payments` **PASS** |
| Uploads на Vercel | `/api/v1/uploads` → S3 при `S3_*` (Yandex Object Storage); без S3 на Vercel → **503** (не local FS) | upload URL `storage.yandexcloud.net` в mvp/full smoke; unit + `cabinet` upload UX |
| **Local VED uploads (Compose/dev)** | `POST /api/v1/uploads` → `public/uploads/ved/`; `GET /uploads/ved/[filename]` route; volume `ved_uploads`; entrypoint `containers/web/docker-entrypoint.sh` | `storage: local` в smoke; Vercel без S3 unchanged |
| **Customs fees (VAT 22%, ПП 1637)** | [`customs-fees.ts`](../../src/lib/ved/customs-fees.ts) + mirrors `containers/{ai,api,llm}`; wiring в draft + `computePayments` | unit `customs-fees.test.ts` · [`customs-payments.md`](./customs-payments.md) |
| **Смета без доставки** | [`landed-cost.ts`](../../src/lib/ved/landed-cost.ts): инвойс USD/CNY/EUR → ТС (+2%) → платежи; snapshot `aiDraft.landedWithoutFreight`; dual-path `containers/api` | unit `landed-cost.test.ts` · [`plan-landed-without-freight.md`](./plan-landed-without-freight.md) |
| **LLM lookup-v1 (compose/local)** | `containers/llm` corpus classify + enrich; gate `llmEnrichEnabled`; **не** prod CTA | `smoke:chain-llm` · [`ai-pipeline.md`](./ai-pipeline.md) |
| **Прецеденты БД-2 (compose/local)** | `verified_determinations` + pgvector `precedent-v2`; precedent-first create; write-back на approve; **C35c** ops count | `smoke:precedent-csv` · `ops:precedent-count` · `smoke:precedent-vector` · [`plan-precedent-bulk.md`](./plan-precedent-bulk.md) |
| **CSV/XLSX/PDF import preview (API + UI)** | `POST /api/v1/imports/products/preview` (`csv`/`xlsxBase64`/`pdfBase64`) + `ProductCsvImport`; create через `/calculations`; лимит D10 | `smoke:csv-import` · `smoke:pdf-import` · unit `product-import.test.ts` |
| **OCR P2 (compose)** | `containers/ocr` text PDF (`ocr-pdf-*-v1`) + optional vision; create fail-open; extract-table | unit `ocr-llm.test.ts` · local `:4700` |
| **Broker reclassify** | `POST …/reclassify` + WorkMapping feedback → LLM (skip precedent); `IN_REVIEW` | `smoke:reclassify` |
| Shipping UI flag | `shippingUiEnabled` (`src/lib/ved/cabinet-features.ts`): nav/дашборд/pane «Перевозка» **скрыты** по умолчанию; код и `/api/v1/shipping` сохранены; `/cabinet/shipping` → redirect на дашборд | unit `cabinet-features`; go-live: `NEXT_PUBLIC_SHIPPING_UI=1` ([`roadmap.md`](./roadmap.md) §2.2) |
| Factory UI flag | `factoryUiEnabled`: код default off; **Vercel Pro Production/Preview `NEXT_PUBLIC_FACTORY_UI=1`**. Client must read `process.env.NEXT_PUBLIC_*` literally (не `env[key]`) иначе Next не инлайнит и UI остаётся скрытым. **C6:** designer chrome (плитка/admin nav) additionally hidden via `designerManufacturerChromeEnabled`. | unit `cabinet-features`; env + [`environments.md`](./environments.md) |
| Build-safe public API | `/api/promos` + `/health` = `force-dynamic` (не prerender без runtime `DATABASE_URL`) | `npm run build` · `/health` `databaseUrl` |
| Status machine + pay gate (D8/D11) | `src/lib/ved/domain.ts` + calculations | unit + `smoke:full` / `mvp` |
| Item limits (D10) / real items (D15) | domain + UI | unit invariants |
| DB sequencing (D23) | [`db-process.md`](./db-process.md), create/pay/claim tx | unit |
| **D24 data model** (attrs / TnvedCode / CalculationEvent) | Prisma + Next + `containers/api`; seed ТН ВЭД; sweb `db push` | [`data-model.md`](./data-model.md) · unit `data-model-d24` · contracts |
| AI draft heuristic (+ optional LLM fail-open S6) | `requestAiDraft`, `containers/llm` | unit + smoke log |
| Cabinets UI baseline (D14) | tag `ved-ui-cabinets-baseline`, design-KB split | [`design.md`](./design.md) |
| Design refs interactive | `docs/design/refs/*.html` | [`design-interactive.md`](./design-interactive.md) |
| Opt-in C4 providers | payments / notify / logistics / llm по env | [`growth.md`](./growth.md) |
| C5 gateway smoke | `containers/gateway`, `smoke:gateway` | cutover отложен (D22) |
| Карта сред | [`environments.md`](./environments.md) Mode A/B/Vercel | `test:structure` |
| Preview/prod smoke playbook | [`staging.md`](./staging.md); smoke scripts: retry + 45s timeout против flaky Vercel fetch | после merge в `main` |
| Orchestration D26 | `BackgroundJob` / `ServiceOutbox` / `ServiceCall`; worker drain | unit `orchestration` · contracts d-orch |
| Platform gates | marketplace / acceptingJobs / maintenance / **payments / llm / notify / mockTopup** | unit `platform-gates` · dual-path · [`admin-ops.md`](./admin-ops.md) |
| Admin SUPPORT + orch UI | `/admin/support`, `/admin/orch` (+ **POST retry** FAILED/DEAD) | session API `platform/orch`; unit `orchestration` |
| **ADMIN ops (D28)** | toggles + integrations (payments/llm/**notify**) + audit/users без SUPER; obscure SUPER CMS | unit `audit-super` · `admin-paths` · [`admin-ops.md`](./admin-ops.md) |
| **ADMIN cabinet UX** | client drill-down + ADJUSTMENT; calc `?id=` + PDF link; support unread; users create/reset; brokers **acceptingJobs**; finance filter/**CSV**; **/tnved** import UI | unit `admin-company` · `admin-paths` · [`cabinets/admin/`](./cabinets/admin/) |
| **OCR P2 (compose)** | text PDF import + extract-table; create fail-open | `smoke:pdf-import` · [`plan-ocr-vision.md`](./plan-ocr-vision.md) |
| **OCR vision (`imageBase64`)** | backend `ocr-vision-v1` в `containers/ocr`; **hold** E2E до ключа + UI | см. план §Hold |
| Landing → auth CTAs | `src/components/landing/markup.ts` + `initLanding` → `/login` \| `/register` (не fake email-modal) | prod после merge PR #1 · [`feature-cycle.md`](./feature-cycle.md) |
| Broker F21 footer | pill `acceptingJobs` + `rating`/`closedPerWeek` в side-foot | unit `side-foot`; [`design-parity.md`](./design-parity.md) |
| Broker ops UX | unread badge «Чат»; attrs на WorkMapping; soft poll 45с + «Обновить»; escalate own IN_REVIEW | [`cabinets/broker/`](./cabinets/broker/) · unit escalate + `countBrokerUnread` |
| VedToast + unread badges | `feedback/VedToast`; pay/claim/approve/support toasts; badge «Заявки»+«Поддержка» (`scope=unread`) | skills `.cursor/skills/ved-ui`, `ved-notify` |
| Client polish UX | settings→profile; `/orders?id=` deep-link; compact topup-then-pay; SUPPORT thread read | [`cabinets/client/`](./cabinets/client/) |
| LLM enrich (P1b) | Next `llm-enrich` + api create fail-open | set `LLM_SERVICE_URL` |
| Container inventory | 14 + ocr scaffold | [`../containers.md`](../containers.md) · [`containerization.md`](./containerization.md) |
| Container add priorities (P1a/P1b–P3) | P1a now (D27); P1b Growth; ocr scaffold; anti-patterns D19 | [`../../containers/README.md`](../../containers/README.md) §«Что добавлять» · [`growth.md`](./growth.md) |
| Parallel ownership / multi-model (D35) | packages domain/orch/mesh; LBM-owned containers/{llm,ocr} | [`plan-parallel-ownership.md`](./plan-parallel-ownership.md) · [`PACKAGES.md`](../../src/lib/ved/PACKAGES.md) |
| Tech-debt M2 (tsc / PROTECTED / dual-path docs) | `npm run typecheck` in `test:ci`; `EnvBag`; adjust+imports in `PROTECTED_V1`; customs-fees canon synced | [`plan-tech-debt.md`](./plan-tech-debt.md) · [`dual-path-parity.md`](./dual-path-parity.md) |
| Автономия / full split (**D36**) | nested `./llm` удалён из git; MVP без матрицы | [`plan-full-split-ibm-cargo.md`](./plan-full-split-ibm-cargo.md) · smoke #47936 |
| Vision-before-classify | **done** — OCR_TIMEOUT 90s; no classify until Qwen OK (requeue); last attempt fail-open; maxDuration 300 | [`plan-vision-before-classify.md`](./plan-vision-before-classify.md) |
| Vision step logging | **done** — `[ai-drain]` phases + ServiceCall.fetch + `aiDraft.visionTrace` | [`plan-vision-before-classify.md`](./plan-vision-before-classify.md) §Пошаговые логи |
| Client LLM soft-fail notice | **done** — `aiDraft.llmSoftFails` + «Тестовый режим» в карточке/PDF | [`plan-client-llm-soft-fail.md`](./plan-client-llm-soft-fail.md) |
| Orch↔llm runChain | **done** — `chains/run-chain` + `docker-compose.chain-03.yml`; rules slim + `sync:cursor-rules` | [`plan-llm-orch-run-chain.md`](./plan-llm-orch-run-chain.md) |
| AI chains 1/2/3 | **done** — registry + `AI_CHAIN_ID`; default **2**; chain **3** DeepSeek vision+classify | [`plan-ai-chains-1-2-3.md`](./plan-ai-chains-1-2-3.md) · `src/lib/ved/chains/` |
| Product focus D27 | частник: ТН ВЭД → брокер-QC → PDF; «под ключ» отложено | [`product.md`](./product.md) · ADR D27 · polish без logistics/LLM/acquiring |
| Dual-path / notify runbook | F17/F19 checklist | [`dual-path-parity.md`](./dual-path-parity.md) · [`runbook.md`](./runbook.md) |

Прод UI: hostname `ibm-cargo.vercel.app` — **чужой** проект. Этот репозиторий: Vercel Preview `ibm-cargo`. **Backup ядра (D37):** https://taurus-liart.vercel.app — read-only, не deploy/smoke. Активный контур: Preview · local · Compose · VPS.

## В работе / не на `origin/main`

| Тема | Статус | Куда смотреть |
|------|--------|----------------|
| D26+D27 + polish UX | **на `origin/main`**; sweb schema synced; `S3_OBJECT_ACL` on Vercel; prod smoke mvp/full **PASS** | [`runbook.md`](./runbook.md) · [`roadmap.md`](./roadmap.md) §Post-polish · [`staging.md`](./staging.md) |
| Broker chat threads UI + DevEx (`setup`, `.nvmrc`) | **done** на `main` (merge chat-threads) | [`design-parity.md`](./design-parity.md) |
| Shipping UI go-live | **hold (D27)** — код готов, flag **off**; не включать `NEXT_PUBLIC_SHIPPING_UI=1` как MVP CTA | [`roadmap.md`](./roadmap.md) §2.2 · `cabinet-features.ts` |
| Полный каталог ТН ВЭД | **Coverage P0–P2** (#43): WRONG fixes + triggers + packs `fruit-fresh` / `woven-apparel` / `prepared-food`. Open sections: art-97, bags-42, watches-91, bev-22, audio, furniture, tires, bikes · [`plan-hint-coverage-p0.md`](./plan-hint-coverage-p0.md). Precision #39–#42. Prod https://ibm-cargo-phi.vercel.app. | [`plan-lbm-bro-tnved-catalog.md`](./plan-lbm-bro-tnved-catalog.md) · [`plan-classify-cascade-c23.md`](./plan-classify-cascade-c23.md) |
| LLM-as-CTA / matcher UX | **hold (D27)** — heuristic-v1; `LLM_SERVICE_URL` только opt-in fail-open | [`ai-pipeline.md`](./ai-pipeline.md) · [`growth.md`](./growth.md) |
| TN VED search/UI attrs/events | **done** (polish §2.5) | [`data-model.md`](./data-model.md) · [`roadmap.md`](./roadmap.md) |
| Real ЮKassa / notify на prod | Track A ops — mock topup + SMTP_FROM; **нужен RESEND + ЮKassa host** | [`plan-track-a-p0.md`](./plan-track-a-p0.md) · `npm run ops:track-a` |
| C5 slim cutover | **hold (D27/D22)** — gateway smoke PASS; cutover ADR отдельно | [`web-slim.md`](./web-slim.md) |
| Support inbox + settings enforcement | **done** (admin reply + gates + D28 toggles) | [`cabinets/shared/correctness.md`](./cabinets/shared/correctness.md) · [`admin-ops.md`](./admin-ops.md) |
| ADMIN ops harden (D28) + notify honesty + landing/F21 + broker ops UX + **admin cabinet UX** (+ tnved / orch retry / finance CSV / acceptingJobs) | **на `main` / prod** (merge PR #1, 2026-08-12); smoke mvp/full PASS | [`admin-ops.md`](./admin-ops.md) · [`cabinets/admin/`](./cabinets/admin/) · [`cabinets/broker/`](./cabinets/broker/) · [`feature-cycle.md`](./feature-cycle.md) |
| P1b logistics/LLM/payments depth | Growth — после polish | [`growth.md`](./growth.md) |
| LLM fill-hints (attr chips + 👍 черновик + similar precedents) | **на `main` / Hobby** — heuristic chips; HELPFUL → `CLIENT_HELPFUL`; broker similar HS | [`plan-llm-fill-hints.md`](./plan-llm-fill-hints.md) |
| Qwen→DeepSeek `AI_DRAIN` | **Compose** service URLs **или Vercel** keys: create enqueue + `after()`/worker; кабинет poll ≤2 мин до точного `hsCode`. | local · prod · [`plan-ai-mesh.md`](./plan-ai-mesh.md) |
| Attr suggest chips + NewCalc tips | **на `main` / Hobby** — heuristic chips; progressive FieldLabel/StageTip; quick-calc без placeholder ноутбука | [`plan-llm-fill-hints.md`](./plan-llm-fill-hints.md) · [`plan-newcalc-hints.md`](./plan-newcalc-hints.md) |
| Cabinets WIP (manufacturer / factory / landed) | **на `main` / Vercel Pro**; Factory UI **on** (`NEXT_PUBLIC_FACTORY_UI=1`). Schema: `manufacturer_proposal`. | [`plan-consolidate-orders.md`](./plan-consolidate-orders.md) · [`cabinets/manufacturer/`](./cabinets/manufacturer/) |
| **lbm-bro visual live** | **этот PR:** `/cabinet` `/broker` `/admin` = `LbmCabinetsShell`; CLIENT home → `/cabinet`; lab `/client` референс | [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md) |

### Post-ship verify (2026-08-20)

- **sweb:** `prisma migrate deploy` — applied `20260815140000_manufacturer_proposal`; admin proposals API 200.
- **Vercel `manufacturer`:** git unlink + `commandForIgnoringBuildStep=exit 0`; Hobby UI = root Next `/manufacturer`. Tip `21b05c4` may still show historical red manufacturer status; new commits without that project link should be root-only.
- **Hobby/Pro:** `test:ci` 370; `smoke:mvp` ×2 PASS; CLIENT/MANU/ADMIN/BROKER APIs 200.
- **Compose AI_DRAIN:** unit enqueue + non-stub; live mesh needs ocr/llm URLs.
- **Pro enable:** `NEXT_PUBLIC_FACTORY_UI=1`; `jobs-tick` cron `*/15`; **`CRON_SECRET` on Vercel** (required for cron auth; added 2026-08-21). Without it jobs stay QUEUED.
- **Orch backlog:** `OUTBOX_DRAIN` / outbox PENDING can accumulate until cron auth works + RESEND for email delivery (Track A).

## Legacy

CMS (posts, telegram, gallery…) — только **SUPER_ADMIN** на obscure path (D6/D28); не в `/admin` nav и не в `containers/admin`. Credentials — seed/private ops, не публичные демо-строки. Legacy public routes вроде `/api/promos` остаются dynamic (не ломать Vercel build).

## Дальше

План фаз: [`roadmap.md`](./roadmap.md) · пошагово polish: [`plan-mvp-polish.md`](./plan-mvp-polish.md).  
Opt-in провайдеры и smokes: [`growth.md`](./growth.md), [`testing-branches.md`](./testing-branches.md).  
C5 slim cutover — после `smoke:gateway` ([`web-slim.md`](./web-slim.md)).  
Vision OCR/Risk/mobile: [`product.md`](./product.md). Сначала зелёный `npm run test:ci`.
