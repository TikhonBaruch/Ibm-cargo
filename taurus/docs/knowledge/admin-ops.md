# ADMIN ops (D28)

Операционный контур роли **ADMIN** на `/admin` и скрытие **SUPER**.  
ADR: [`decisions.md`](./decisions.md) **D28** · UI: [`cabinets/admin/`](./cabinets/admin/) · as-is: [`current-app.md`](./current-app.md).

## Карта разделов

| Раздел | Route | Назначение |
|--------|-------|------------|
| Дашборд / Заявки | `/admin`, `/bookings` | сводка + таблица; **карточка calc** · PDF link · deep-link `?id=` |
| Клиенты | `/clients` | drill-down компании · ledger · **ADJUSTMENT** · `?company=` |
| Брокеры / Тарифы / Финансы | `/brokers`, `/tariffs`, `/finance` | модерация · **acceptingJobs** · цены · фильтр/CSV · mark PAID |
| Support / Orch / ТН ВЭД | `/support`, `/orch`, `/tnved` | inbox + unread; orch **retry**; JSON import |
| Интеграции | `/integrations` | payments + LLM + **notify**: health, I/O, toggles |
| AI-качество / Настройки | `/ai-quality`, `/settings` | пороги + все feature off-switches |
| Пользователи | `/users` | create ADMIN/EDITOR/CLIENT/BROKER · reset password · без SUPER |
| Журнал | `/audit` | audit без SUPER |

Deep-link: `/admin/bookings?id=` · `/admin/clients?company=`.  
Support badge = `countAdminUnread` (SUPPORT с `waitingOn=BROKER`).

Paths: `ADMIN_CABINET_PATHS` · extract: `containers/admin`.  
**Схема экранов и взаимодействий (existing/required/future):** [`cabinets/admin/schema.md`](./cabinets/admin/schema.md).

## Выполнено на ветке (2026-08-10)

Код на `cursor/admin-ops-harden` (ещё не `origin/main` / prod):

| Блок | Что |
|------|-----|
| P0 cabinet | company drill-down + ADJUSTMENT; calc detail (items / assign / escalate / **PDF link**); users create/reset |
| P1 ТН ВЭД | `/admin/tnved` · `POST /api/v1/tnved/import` · path в `ADMIN_CABINET_PATHS` + `containers/admin` |
| P1 финансы | фильтр ACCRUED/DOCS_REQUESTED/PAID · **CSV export** |
| P1 orch | `POST /api/v1/platform/orch` `{ action: retry_job\|retry_outbox, id }` · UI Retry |
| P1 брокеры | `PATCH /api/v1/brokers` `{ acceptingJobs }` · пауза приёма в UI |

Unit: `orchestration` (retry) · `admin-paths` (+ tnved) · `test:ci` green.  
ADR: D28 §6–7 · UI: [`cabinets/admin/`](./cabinets/admin/).

## Feature toggles

| Ключ | Default | Эффект |
|------|---------|--------|
| `marketplaceEnabled` | true | список брокеров клиенту |
| `autoAssignBrokers` | false* | auto-claim после pay |
| `maintenanceMode` | false | блок create/pay |
| `paymentsEnabled` | true | topup/pay; `false` → отказ (кроме already-paid) |
| `llmEnrichEnabled` | true | внешний LLM при create; `false` = heuristic |
| `notifyEnabled` | true | skip outbox kick / notify delivery |
| `mockTopupAllowed` | true** | AND с `ALLOW_MOCK_TOPUP` env |

\* seed/settings as-is · \*\* missing key = on (`=== false` only turns off).

Enforce: `src/lib/ved/platform-gates.ts` + `payments.ts` / `ai.ts` / `orchestration.ts` + dual-path `containers/api`.  
Unit: `platform-gates.test.ts`.

## Интеграции

- API: `GET /api/v1/platform/integrations` (`ADMIN_ROLES`).
- Карточки: **payments** / **llm** / **notify** — masked host, orch-health dep, last N `ServiceCall`, toggle.
- **Не** в UI: raw API keys, редактор `PAYMENTS_SERVICE_URL` / `LLM_SERVICE_URL` / `NOTIFY_SERVICE_URL`.

## Клиенты и баланс

- `GET /api/v1/company/[id]` — компания + users + ledger(50) + recent calcs (`ADMIN_ROLES`).
- `POST /api/v1/company/[id]/adjust` `{ amountRub, reason }` — `LedgerKind.ADJUSTMENT` через `creditCompany` + audit.
- Domain: `src/lib/ved/admin-company.ts` · dual-path `containers/api`.
- Unit: `admin-company.test.ts`.

## Пользователи (VED)

- `GET/POST /api/admin/users` — list без SUPER; **ADMIN и SUPER** могут create (роли ≠ SUPER).
- `PATCH /api/admin/users/[id]` — ADMIN может `resetPassword` для non-SUPER; смена role — только SUPER.
- UI `/admin/users`: форма create + кнопка сброса (one-time password).

## Брокеры / финансы / orch / ТН ВЭД

- `PATCH /api/v1/brokers` — `{ brokerProfileId, status? }` и/или `{ acceptingJobs? }` (`ADMIN_ROLES`).
- Финансы UI: фильтр статуса выплат + client-side CSV (без отдельного export API).
- Orch: `GET /api/v1/platform/orch` snapshot; `POST` retry → `retryBackgroundJob` / `retryOutboxMessage` (+ enqueue `OUTBOX_DRAIN`). Unit: `orchestration.test.ts`.
- ТН ВЭД: UI `/admin/tnved` → существующий `POST /api/v1/tnved/import` (batch ≤500). Полный номенклатурный dump — Track B ([`data-model.md`](./data-model.md)).
- **Два слоя ТН ВЭД** ([`data-model.md`](./data-model.md) §2.1): **corpus** `llm/data/tnved/normalized/codes.jsonl` → `containers/llm` classify (lookup-v1); **Prisma** `TnvedCode` → broker autocomplete + admin import. Compose mount: `../llm/data/tnved/normalized:/data/tnved:ro` + `TNVED_CODES_PATH`. Не смешивать runtime corpus с DB import.
- Toggle **`llmEnrichEnabled`**: `false` = heuristic only; `true` + `LLM_SERVICE_URL` = corpus lookup-v1 ± OpenAI/NIM rerank (fail-open).

## SUPER (obscure)

- Surface: константы `src/lib/ved/super-admin.ts` (path не дублировать в публичных демо).
- Audit: SUPER actions не пишутся; list API скрывает SUPER rows.
- Users API: `role: { not: "SUPER_ADMIN" }`; create SUPER запрещён.
- Credentials: seed / private ops only — не AGENTS / login CTA / KB demo tables.
- Infra accordion: только SUPER panel (`infra-access.ts` + `OPS_*` env).
- CMS panes на obscure root: stats / SEO / site settings / bookings / infra — не в `containers/admin`.

## Связанные проверки

| Что | Где |
|-----|-----|
| Correctness gates | [`cabinets/shared/correctness.md`](./cabinets/shared/correctness.md) |
| Live chain | [`chain-verification.md`](./chain-verification.md) |
| Track A demo roles | [`plan-track-a-p0.md`](./plan-track-a-p0.md) A3 |
| Dual-path | [`dual-path-parity.md`](./dual-path-parity.md) |
