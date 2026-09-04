# Дизайн — parity реф ↔ live

Сверка HTML-рефа кабинетов с живым UI.  
Индекс: [`design.md`](./design.md). Реф: [`cargo-broker-cabinets.html`](../design/refs/cargo-broker-cabinets.html).

## Таблица экранов

| Роль | Экран | Реф (pane) | Live (route) | Gap |
|------|-------|------------|--------------|-----|
| Клиент | Дашборд | `c-dash` ✓ | `/cabinet` ✓ | — |
| Клиент | Заявки | `c-orders` ✓ | `/cabinet/orders` ✓ | master-detail: `VedDetailDrawer` + `?id=` + mobile cards |
| Клиент | Новый просчёт | dash / CTA ✓ | `/cabinet/new` ✓ | invoice flex OK; EXPRESS без брокера; сайдбар листьев (`NewCalcDirectoryHints`, blur → `hsHint`); C21 clarify слева; typeahead: описание/`shipCountry`/`originCountry` (без truncate RU); manufacturer stub |
| Клиент | Брокеры | `c-brokers` ✓ | `/cabinet/brokers` ✓ | — |
| Клиент | Перевозка | `c-ship` ✓ | `/cabinet/shipping` ✓ | **UI скрыт** flag off (`NEXT_PUBLIC_SHIPPING_UI`); код/API сохранены |
| Клиент | Баланс | `c-balance` ✓ | `/cabinet/balance` ✓ | — |
| Клиент | Поддержка | `c-support` ✓ | `/cabinet/support` ✓ | FAQ + ticket + **thread + archive tabs**; deep-link на заявки и `?threadId=` |
| Клиент | Настройки | `c-settings` ✓ | `/cabinet/settings` → `/profile` | redirect; один `CompanySettingsPane` |
| Клиент | Профиль | `c-profile` ✓ | `/cabinet/profile` ✓ | реквизиты компании |
| Брокер | Дашборд | `b-dash` ✓ | `/broker` ✓ | — |
| Брокер | Очередь | `b-queue` ✓ | `/broker/queue` ✓ | `VedDetailDrawer` + claim/open CTA honesty |
| Брокер | В работе | `b-work` ✓ | `/broker/work` ✓ | drawer + WorkMapping mobile cards |
| Брокер | Чат | `b-chat` ✓ | `/broker/chat` ✓ | desktop split; mobile drawer |
| Брокер | SLA | `b-sla` ✓ | `/broker/sla` ✓ | bars live |
| Брокер | Выплаты | `b-pay` ✓ | `/broker/payouts` ✓ | — |
| Брокер | Профиль | `b-profile` ✓ | `/broker/profile` ✓ | — |
| Админ | Дашборд | `a-dash` ✓ | `/admin` ✓ | open calc from attention |
| Админ | Заявки | `a-orders` ✓ | `/admin/bookings` ✓ | detail drawer + `?id=` |
| Админ | Клиенты | `a-clients` ✓ | `/admin/clients` ✓ | drill-down + ADJUSTMENT · `?company=` |
| Админ | Брокеры | `a-brokers` ✓ | `/admin/brokers` ✓ | — |
| Админ | Тарифы | `a-tariffs` ✓ | `/admin/tariffs` ✓ | — |
| Админ | Финансы | `a-finance` ✓ | `/admin/finance` ✓ | — |
| Админ | Поддержка | — | `/admin/support` ✓ | фильтры inbox + Close/Archive + unread badge |
| Админ | Интеграции | — | `/admin/integrations` ✓ | payments/llm/notify |
| Админ | Пользователи | — | `/admin/users` ✓ | create + reset |
| Админ | AI-качество | `a-ai` ✓ | `/admin/ai-quality` ✓ | — |
| Админ | Audit | `a-audit` ✓ | `/admin/audit` ✓ | — |
| Админ | Настройки | `a-settings` ✓ | `/admin/settings` ✓ | — |
| Mobile | Онбординг → profile | wireframe ✓ | — | product app = Growth |
| Mobile | Tabbar | wireframe ✓ | — | product app = Growth |

## UI backlog

Не блокер направления «интерактивный дизайн»; доработки live UI от baseline D14:

- ~~thumbs `mediaUrl` на карточке работы брокера~~ **done**
- ~~SLA pane: средний ответ / % в срок / AI≠HS bars~~ **done** (live + progress bars)
- ~~presence «Онлайн» / рейтинг в footer сайдбара~~ **done** (F21: `acceptingJobs` pill + `rating`/`closedPerWeek` from BrokerProfile; `formatBrokerSideFoot`)
- ~~landing CTA → fake modal~~ **done** → `/login` \| `/register` (`markup.ts` / `initLanding`; ветка `cursor/admin-ops-harden`)
- ~~escalate-кнопка (admin)~~ **done** (status-gated QUEUED/IN_REVIEW)
- ~~список тредов чата (broker)~~ **done** (`ChatThreadsPane` + `scope=threads`)
- ~~toast / snackbar в live cabinets~~ **done** (`VedToast` · D14 style; pay/claim/approve/support)
- ~~client Support unread nav badge~~ **done** (`/api/v1/chat?scope=unread` → badge «Поддержка» + «Заявки»)
- ~~broker chat unread nav badge~~ **done** (`scope=unread` for BROKER → badge «Чат»)
- ~~client settings/profile merge~~ **done** (`/settings` → `/profile`; один nav)
- ~~client deep-link `/orders?id=`~~ **done** (openCalc + SupportPane)
- ~~client SUPPORT thread read~~ **done** (полный тред + `?threadId=` + archive tabs)
- ~~list compact topup-then-pay~~ **done** (DashboardPane orders cards)
- ~~attrs на карточке работы брокера~~ **done** (read-only колонка в WorkMapping)
- ~~broker товарное описание + прочие сборы~~ **done** (`plan-broker-desc-fees.md`)
- ~~broker empty attrs fill~~ **done** (`plan-broker-empty-attrs.md`)
- ~~broker escalate (own IN_REVIEW)~~ **done**
- ~~soft refresh queue/chat~~ **done** (45s poll + «Обновить»)
- ~~admin client drill-down + ADJUSTMENT~~ **done** (`/clients?company=` · [`admin-ops.md`](./admin-ops.md))
- ~~admin calc deep-link `?id=`~~ **done** (`/bookings?id=`)
- ~~admin SUPPORT unread badge~~ **done** (`countAdminUnread`)
- ~~admin integrations notify card~~ **done**
- ~~admin users create/reset (no SUPER)~~ **done**
- ~~admin PDF link in calc detail~~ **done**
- ~~admin `/tnved` import UI~~ **done** ([`admin-ops.md`](./admin-ops.md))
- ~~admin finance filter + CSV~~ **done**
- ~~admin orch retry FAILED/DEAD~~ **done**
- ~~admin broker acceptingJobs toggle~~ **done**
- ~~master-detail drawers (client/broker/admin)~~ **done** (`VedDetailDrawer`; Escape/backdrop; mobile fullscreen)
- ~~broker client feedback on DONE~~ **done** (`BrokerClientFeedback` · PR broker QC loop 2026-08-14)
- ~~broker reclassify UI gate~~ **done** (`llmEnrichEnabled` from platform settings)
- ~~broker row TN VED duty/VAT hints~~ **done** (`applyTnvedRowHint`)
- ~~broker nav badge «В работе»~~ **done**
- ~~broker thin dossier (AI weak / no manufacturer)~~ **done** (`BrokerDossierPane` + chat request + comment gate)
- ~~admin clients VedDetailDrawer~~ **done** (`AdminCompanyDetailDrawer` · list + `?company=`)
- ~~GET calc omit `pdfHtml` + `hasPdf`~~ **done** (list + by-id; dual-path)
- ~~Empty states / копирайт D27 (M0.3)~~ **done** (`VedEmptyState`; клиент/брокер/admin — [`cabinets/ux-saas.md`](./cabinets/ux-saas.md) §8)
- ~~Admin-nav группы~~ **done** (Операции / Каталог / Платформа в `VedShell`; badge на «Поддержка»; [`cabinets/ux-saas.md`](./cabinets/ux-saas.md) §5)
- **Command palette `Cmd+K`** — **hold** (мало объектов; лечить группы nav)
- ~~Кабинет производителя v1~~ **done** (D31 `/manufacturer` · SKU catalog; не CTA D27)
- **Перевозка / LLM / ЮKassa** — вне матрицы polish; см. [`plan-mvp-polish.md`](./plan-mvp-polish.md) §Вне скоупа

При закрытии gap — обновить эту таблицу, не дублировать в `design-baseline.md`. Приоритеты фич polish: [`plan-mvp-polish.md`](./plan-mvp-polish.md) §Матрица.

## UI lab lbm-bro (три кабинета)

Live chrome принят (фаза C): [`plan-lbm-bro-visual.md`](./plan-lbm-bro-visual.md). Lab `/client` — референс.

| Роль | Экран | Lab | Domain | Статус |
|------|-------|-----|--------|--------|
| Клиент | Superapp home | `/client` ✓ | `/cabinet` ✓ product-shell | **live chrome** + `/api/v1` |
| Клиент | Заявки / карточка / wizard | `/client/orders` · `/new` ✓ | `/cabinet/orders` · `/new` ✓ | live panes в новом шелле |
| Клиент | Справочник ТН ВЭД | `/client/tnved` ✓ | combobox NewCalc | lookup-плитка → `/new` |
| Брокер | Dash / queue / work / chat / SLA / pay / profile | компоненты `broker-*` | `/broker/*` ops-shell | WorkMapping канон QC |
| Админ | Dash / 14 panes | компоненты `admin-*` | `/admin/*` ops + группы | без fake GMV |
| — | Proto-bar | `/client` layout | запрещён в prod (D14) | только lab |
