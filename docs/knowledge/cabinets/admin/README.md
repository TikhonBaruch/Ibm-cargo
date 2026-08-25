# Контейнер admin (D20 / D28) — элементы UI

**Код:** `src/components/ved/AdminVedCabinet.tsx` (~816 LOC orchestrator) + `src/components/ved/admin/*` panes  
**UI сводка (vs client/broker):** [`../ui-guide.md`](../ui-guide.md) · **Схема взаимодействий:** [`schema.md`](./schema.md) · **Ops map:** [`../../admin-ops.md`](../../admin-ops.md) (D28)  
**Routes VED:** `app/admin/{,bookings,clients,manufacturers,brokers,tariffs,finance,support,orch,tnved,integrations,ai-quality,settings,users,audit}`
**Extract:** `containers/admin/app/*` (:3001) — VED parity OK  
**Legacy CMS** (SUPER_ADMIN only, D6): obscure path `/2178737` — posts, gallery, telegram, **SEO**, **настройки сайта**, **инфраструктура**, **заявки CMS**, users, audit — **не** в containers/admin; старые `/admin/posts` и т.п. → redirect

**Demo roles:** `operator@` / `admin@` = `ADMIN` (VED `/admin`). Скрытый SUPER-уровень — только seed/private ops (не в UI пользователей и не в публичных демо).  
Настройки: feature toggles (payments/llm/notify/mock) + **Интеграции** (`/admin/integrations`) — health и I/O ServiceCall. Журнал `/admin/audit` без действий SUPER.

### SUPER CMS management (`/2178737`)

| Раздел | Route | Управление |
|--------|-------|------------|
| Обзор | `/` | Сводка CMS stats + карточки разделов + infra |
| Контент | `/posts` `/promos` `/reviews` `/gallery` `/specialists` | CRUD legacy |
| SEO | `/seo` | Meta / OG по `pageKey` |
| Заявки CMS | `/bookings` | Legacy `Booking` status |
| Пользователи | `/users` | CRUD ролей (без SUPER) |
| Коммуникации | `/chat` `/telegram` | CMS chat / recipients |
| Настройки сайта | `/settings` | Restricted mode + ссылки на VED |
| Инфраструктура | `/infra` | Env / доступы (`/api/admin/infra`) · D32 loading/error retry |
| Audit | `/audit` | Журнал (без SUPER в VED `/admin/audit`) |

## Nav (`getAdminNav`)

Сайдбар: группы **Операции / Каталог / Платформа** (подписи видны сразу, не аккордеон). Мобильные chips — плоский список. Badge unread — на пункте «Поддержка», не на заголовке группы. Канон: [`../ux-saas.md`](../ux-saas.md) §5.

| Группа | Элемент | Route | Информирование | Взаимодействие |
|--------|---------|-------|----------------|----------------|
| Операции | Дашборд | `/admin` | Счётчики; bar статусов; attention | Переходы · open calc |
| Операции | Заявки | `/bookings` | `.card` + `.search-row` + `table.data`; badge QUEUED+SLA_RISK | Search, filter, **Открыть**, assign, escalate · `?id=` |
| Операции | Клиенты | `/clients` | live `.stats` + `.filter-chips` + `table.data` | Drill-down · **PATCH реквизиты** · **ADJUSTMENT** · `?company=` · инвайт через Users |
| Операции | Производители | `/manufacturers` | Очередь PENDING + постоянный каталог; badge | Approve / Reject · drawer компании · [`plan-manufacturer-proposals.md`](../../plan-manufacturer-proposals.md) |
| Операции | Брокеры | `/brokers` | `.person-card` сетка; модерация · acceptingJobs · профиль | Одобрить / Отклонить · пауза · **drawer: specialization/languages/about** |
| Операции | Поддержка | `/support` | SUPPORT inbox (фильтры Нужен ответ / Ждёт клиента / Закрыто / Архив) · nav badge unread | **Ответить** (`SUPPORT_REPLY`) · Close / Archive / Reopen (`SUPPORT_STATUS`) |
| Операции | Финансы | `/finance` | live `.stats` + `table.data` балансы/выплаты | фильтр статуса · **CSV** · **Отметить PAID** |
| Каталог | Тарифы | `/tariffs` | `.tariff-mini` D10 price / share / slaHours | Сохранить; hold-заметка в исходнике (без бейджа) |
| Каталог | ТН ВЭД | `/tnved` | Поиск; форма / CSV / JSON; демо-набор; **карточка кода** | `POST …/import` · `GET …/search` · `GET …/:code` |
| Каталог | AI-качество | `/ai-quality` | = форма settings | confidence, SLA, preferredClaimHours, USD, toggles incl. **`llmEnrichEnabled`** |
| Платформа | Пользователи | `/users` | `.card` + `.field` + `table.data` | create + reset password (без SUPER) |
| Платформа | Интеграции | `/integrations` | Health + ServiceCall I/O | toggles payments/llm/**notify** |
| Платформа | Оркестрация | `/orch` | Jobs / Outbox / **ServiceCall ocr+llm** / deps (D26) | Refresh · **Retry** FAILED/DEAD `AI_DRAIN` |
| Платформа | Журнал | `/audit` | Audit log | Read-only · без SUPER |
| Платформа | Настройки | `/settings` | То же | autoAssign, marketplace, maintenance, payments/llm/notify/mock |

Deep-link: `/admin/bookings?id=` · `/admin/clients?company=`. Support nav badge = unread SUPPORT (`ticketStatus=OPEN` + `waitingOn=BROKER`).

Panes: `DashboardPane`, `BookingsPane`, `ClientsPane`, `BrokersPane`, `FinancePane`, `TariffsPane`, `PlatformSettingsPane`, `IntegrationsPane`, `OrchPane`, `TnvedImportPane`, `UsersPane`, `AuditPane`, `SupportInboxPane`, `AdminCalcDetailDrawer`, `AdminCompanyDetailDrawer`, `AdminBrokerDetailDrawer` · shared `types.ts`. См. [`../../plan-tech-debt.md`](../../plan-tech-debt.md) шаг 7 (**done**) · карточки акторов [`../../plan-admin-actors.md`](../../plan-admin-actors.md).

Badge «Прод · 152-ФЗ» (static). Footer: platform SLA · # approved brokers.

## Platform settings → реальность

| Setting | Persist | Domain enforcement |
|---------|---------|-------------------|
| confidenceThreshold | ✓ | Express DONE vs QUEUED |
| defaultSlaHours | ✓ | SLA at pay |
| usdRate | ✓ | Stored (нет client display) |
| preferredClaimHours | ✓ UI | Preferred exclusive window |
| autoAssignBrokers | ✓ | After pay → claim preferred / top-rated accepting broker |
| marketplaceEnabled | ✓ | CLIENT brokers list empty when off |
| maintenanceMode | ✓ | Blocks client create/pay |
| paymentsEnabled | ✓ | Blocks topup/pay when off |
| llmEnrichEnabled | ✓ | Skip external LLM when off |
| notifyEnabled | ✓ | Skip notify outbox kick when off |
| mockTopupAllowed | ✓ | AND with `ALLOW_MOCK_TOPUP` env |

## API

`calculations` · assign · escalate · company/list · **company/[id]** · **company/[id]/adjust** · brokers (+all, PATCH status/**acceptingJobs**) · tariffs/update · payouts · platform/settings · platform/integrations · platform/orch (GET + **POST retry**) · tnved/import · chat support inbox (+ unread) · `/api/admin/audit` · `/api/admin/users` (ADMIN create/reset)
