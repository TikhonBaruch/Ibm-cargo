# Кабинеты — единый UI-гайд

Сводный документ: **чем роли отличаются**, **что должно быть у админа**, **общие паттерны**, **следующие шаги UI**.  
Визуальный канон — D14 ([`../design-baseline.md`](../design-baseline.md)); удобство и SaaS-аналоги — [`ux-saas.md`](./ux-saas.md); parity/backlog — [`../design-parity.md`](../design-parity.md).  
Ops-контур админа — D28 ([`../admin-ops.md`](../admin-ops.md)).

**Решения 2026-08-13/14:** клиент → брокер → админ (empty states + nav groups + pane split **live**); производитель v1 и `Cmd+K` — **hold**.

---

## 1. Три кабинета — одна оболочка, разные jobs

Все три роли сидят на **`VedShell`** + **`VedToast`**. Различие — **задача роли**, **плотность nav**, **кто управляет платформой**.

```text
                    VedShell (sidebar 260px, accent #2b72f4)
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ClientCabinet         BrokerCabinet         AdminVedCabinet
   orchestrator          orchestrator          orchestrator (~816 LOC)
        │                     │                     │
   client/* panes        broker/* panes      admin/* (14 panes)
   9 extracted           6 extracted         + types.ts
```

| | **Клиент** | **Брокер** | **Админ** |
|---|------------|------------|-----------|
| **Route** | `/cabinet/*` | `/broker/*` | `/admin/*` (VED) |
| **Главный job** | Просчёт → оплата → PDF (D27) | QC оплаченных заявок | Ops платформы: внимание, gates, выплаты, support staff |
| **SaaS-аналог** | Stripe customer portal | Linear triage / review queue | Vercel / Stripe **ops** dashboard |
| **Nav** | 6–7 пунктов, плоский | 7 пунктов, плоский | **14 пунктов**, **3 группы** (Операции / Каталог / Платформа) |
| **Header CTA** | «Новый просчёт» → `/new` | «Открыть очередь» | «Обновить» + badge «Прод · 152-ФЗ» |
| **Mark** | синий | синий | **admin** gradient (blue→purple) |
| **Badges** | Заявки + Поддержка (unread) | Очередь + Чат | Заявки (QUEUED+SLA) + Поддержка (staff unread) |
| **Platform gates** | **Потребляет** (maintenance, payments, marketplace) | **Профиль** `acceptingJobs` | **Полный контроль** toggles + integrations |
| **Pane split** | зрелый | зрелый | **14/14** panes + orchestrator |
| **Demo** | `client@` | `broker@` | `admin@` / `operator@` |

**Клиент и брокер** — «исполнители» одного потока D8: клиент создаёт и платит, брокер правит HS/платежи и утверждает.  
**Админ** — не третий участник просчёта по умолчанию, а **оператор платформы**: модерация, assign/escalate, балансы, feature flags, оркестрация, staff-support.

Legacy **SUPER CMS** (`/2178737`) — **не** VED admin: posts, SEO, infra — D6/D28, obscure path only.

---

## 2. Архитектура UI (код)

| Слой | Клиент | Брокер | Админ |
|------|--------|--------|-------|
| Orchestrator | `ClientCabinet.tsx` | `BrokerCabinet.tsx` | `AdminVedCabinet.tsx` |
| Panes | `ved/client/*` | `ved/broker/*` | `ved/admin/*` |
| Nav helper | `getClientNav()` in `client/types.ts` | `getBrokerNav()` in `broker/types.ts` | `getAdminNav()` in `admin/types.ts` |
| Routes | `app/cabinet/**/page.tsx` | `app/broker/**/page.tsx` | `app/admin/**/page.tsx` |
| Path registry | — | — | `ADMIN_CABINET_PATHS` · `admin-paths.ts` |
| Extract | `containers/client` | `containers/broker` | `containers/admin` (COPY) |

**Паттерн зрелого кабинета:** orchestrator = fetch, routing, badges, toasts; pane = разметка + callbacks.  
**Админ:** orchestrator ~816 LOC; экраны — panes в `ved/admin/*`, routing `pathname === p("/…")`.

---

## 3. Что у админа **должно быть** (канон D28)

Функционально контур **закрыт** — 14 разделов live. Ниже — **обязательный минимум** по проекту.

### 3.1 Операции (ежедневная работа staff)

| Экран | Зачем | Ключевые действия | Deep-link |
|-------|-------|-------------------|-----------|
| Дашборд | «Что горит» | KPI, bar статусов, attention (SLA, low AI, brokers PENDING, payouts) | open calc |
| Заявки | Полный список calc | search/filter, assign, escalate, PDF | `?id=` + drawer |
| Клиенты | Деньги и история компании | drill-down, **ADJUSTMENT** ledger | `?company=` |
| Брокеры | Кто принимает работу | APPROVE/REJECT, **acceptingJobs** pause | — |
| Поддержка | Staff inbox (не брокер!) | reply, resolve, archive, reopen | folder chips |
| Финансы | Выплаты брокерам | filter, CSV, mark PAID | — |

### 3.2 Каталог (редко, но критично)

| Экран | Зачем |
|-------|-------|
| Тарифы | priceRub, brokerSharePct, slaHours (брокер **не** правит price — D15) |
| ТН ВЭД | batch import → `TnvedCode` (форма / CSV / JSON; полный dump = Track B) |
| AI-качество | confidence, SLA hours, preferredClaimHours, **llmEnrichEnabled** |

### 3.3 Платформа (infra + people)

| Экран | Зачем | Ограничение UI |
|-------|-------|----------------|
| Пользователи | create CLIENT/BROKER/ADMIN/EDITOR; reset password | без SUPER |
| Интеграции | payments / llm / **notify** health + ServiceCall | **без URL/keys** в UI |
| Оркестрация | Jobs / Outbox / deps (D26) | Retry FAILED/DEAD |
| Журнал | audit read-only | SUPER rows hidden |
| Настройки | marketplace, maintenance, payments, notify, mockTopup, autoAssign | = форма с AI-качество |

### 3.4 Feature toggles → реальность

Persist `SiteSetting` → enforce `platform-gates.ts` + dual-path `containers/api`.  
Админ **не** «декоративный» — каждый toggle должен резать client/broker/API (см. [`../admin-ops.md`](../admin-ops.md)).

---

## 4. Сравнение UX-паттернов

| Паттерн | Клиент | Брокер | Админ | Канон |
|---------|--------|--------|-------|-------|
| Master-detail | `OrderDetailDrawer` · orders | `VedDetailDrawer` queue/work/chat | drawer **bookings + clients** | URL `?id=` / `?company=` / `?threadId=` |
| Empty state M0.3 | `VedEmptyState` в balance/orders/support | queue paused / dash / chat | support folders | title + why + **one** CTA |
| Inbox vs archive | support active/archive | — | support 4 folders | unread только active |
| Poll / refresh | chat ~12s on open calc | 45s + кнопка | manual «Обновить» | — |
| Shipping UI | скрыт (`NEXT_PUBLIC_SHIPPING_UI`) | — | — | D27 hold |

**Отличие админа от брокера:** брокер работает **с одной заявкой** (mapping, chat по calc); админ смотрит **на всю платформу** (списки, toggles, assign чужому брокеру, ledger компании). Брокер **не** отвечает на SUPPORT; админ — **единственный** staff inbox для platform support.

**Отличие админа от клиента:** клиент **платит и ждёт PDF**; админ **не создаёт просчёт** как основной flow и **не** показывает маркетинговый wizard. UI плотнее, группы nav обязательны.

Предложенный визуал lbm-bro (клиент = светлый superapp; брокер/админ = тёмный ops): [`../plan-lbm-bro-visual.md`](../plan-lbm-bro-visual.md) §1.3–1.6.

---

## 5. Собранные решения (UI)

| ID | Решение | Где |
|----|---------|-----|
| D14 | Один shell, токены, tag `ved-ui-cabinets-baseline` | `design-baseline.md` |
| D27 | MVP CTA = ТН ВЭД → broker QC → PDF; без shipping/LLM/live pay в лице | `product.md` |
| D28 | Admin = ops + toggles + integrations health; SUPER hidden | `admin-ops.md`, `decisions.md` |
| Nav groups | Операции / Каталог / Платформа; badge на «Поддержка» | `ux-saas.md` §5 · **live** |
| Empty M0.3 | `VedEmptyState`; клиент/брокер/admin support | `ux-saas.md` §8 · **live** |
| Cmd+K | **Hold** — 14 пунктов лечатся группами | `ux-saas.md` §7 |
| Manufacturer v1 | **D31+D34 live** — `/manufacturer` + сборные заказы | D29 · этот § |
| No shadcn/Sonner | Tailwind + hex + `VedToast` | skill `ved-ui` |
| Clients drill-down | inline panel (не drawer) — **parity gap** vs bookings | см. §6 |

---

## 6. Gaps (что ещё не доведено в UI)

| Gap | Приоритет | Заметка |
|-----|-----------|---------|
| Admin soft poll (orch/support) | P3 | брокер уже 45s |
| Manufacturer cold-start / broker chat-first / client first-run | **done** | [`plan-cabinets-ux-sprints.md`](../plan-cabinets-ux-sprints.md) |
| Cmd+K | Hold | — |
| Landing/status copy M1.1 | По запросу | не рерайт без ask |
| HS top-N heuristic UI M1.2 | **done** | NewCalc + tips |

---

## 7. Следующие шаги UI — как реализовать

Порядок **не менять**: не смешивать с ЮKassa / shipping / LLM-CTA / manufacturer в одном PR.

### Шаг A — M1.2 HS heuristic (клиент `/cabinet/new`)

Top-N кандидатов + «почему» из правил — **не** кнопка LLM. Отдельная ветка после A–B.

### Шаг B — Manufacturer v1 (D31 live)

`ved/manufacturer/*` · `/manufacturer` · invite ADMIN. Канон: [`manufacturer/`](./manufacturer/) · [`ux-saas.md`](./ux-saas.md) §6.

---

## 8. Чеклист перед UI-PR (любой кабинет)

1. Ветвь 1/2/3 — [`../branches.md`](../branches.md); Prisma не в extract UI panes.
2. Паттерн §4 повторён или ADR.
3. [`../design-parity.md`](../design-parity.md) — строка закрыта/добавлена.
4. Holds D27: shipping CTA, LLM-кнопка, `WEB_SURFACE=slim` — off.
5. Toast на pay/claim/approve/support — `useVedToast()`.
6. `npm run test:ci` green.

Skill агента: [`.cursor/skills/ved-ui`](../../../.cursor/skills/ved-ui/SKILL.md).

---

## 9. Карта документов UI (куда смотреть)

| Вопрос | Документ |
|--------|----------|
| Токены, shell, IA | [`../design-baseline.md`](../design-baseline.md) |
| Реф ↔ live, backlog | [`../design-parity.md`](../design-parity.md) |
| Удобство, SaaS, empty, nav groups | [`ux-saas.md`](./ux-saas.md) |
| **Сравнение ролей + admin schema** | **этот файл** · [`admin/schema.md`](./admin/schema.md) |
| Admin ops / toggles | [`../admin-ops.md`](../admin-ops.md) |
| Admin экраны детально | [`admin/README.md`](./admin/README.md) |
| Client / broker panes | [`client/`](./client/) · [`broker/`](./broker/) |
| Новый визуал клиента (lab) | [`../plan-lbm-bro-visual.md`](../plan-lbm-bro-visual.md) · `/client` vs `/cabinet` |
| Цикл фичи M0–M1 | [`../feature-cycle.md`](../feature-cycle.md) |
| Pane split tech-debt | [`../plan-tech-debt.md`](../plan-tech-debt.md) §7 |
