# Кабинеты — удобство по ветвям и SaaS-аналоги

Канон **удобства** продуктовых кабинетов: ветвь → job → SaaS-паттерн (про работу, не про визуал) → as-is → очередь реализации.  
**Сравнение клиент / брокер / админ и UI roadmap:** [`ui-guide.md`](./ui-guide.md) (единая сводка по ролям).  
Не второй дизайн-язык: токены и shell — **D14** ([`../design-baseline.md`](../design-baseline.md), skill `ved-ui`).  
Не подменяет CTA **D27**: частник = ТН ВЭД → брокер-QC → PDF. Shipping / LLM-чат / ЮKassa / `Cmd+K` — hold.

Инвентарь экранов: [`README.md`](./README.md) · [`client/`](./client/) · [`broker/`](./broker/) · [`admin/`](./admin/) · ownership [`../branches.md`](../branches.md).  
План: [`../plan-cabinets-d32.md`](../plan-cabinets-d32.md) · [`../feature-cycle.md`](../feature-cycle.md) §D · [`../roadmap.md`](../roadmap.md) §«Ближайший план».

**Решения 2026-08-13:** очередь кабинетов **клиент → брокер → админ**; admin-nav **группировать**; кабинет производителя — **v1 после** UX трёх кабинетов (не вместо D27); command palette — **hold**; empty states — паттерн M0.3 (не рерайт лендинга).

---

## 1. Формула удобства

Один главный следующий шаг на экране; URL помнит объект (`?id=` / `?threadId=` / `?company=`); успех/ошибка — `VedToast`, не `alert`; рабочий inbox ≠ архив.

Цель: операционный SaaS (очередь, inbox, master-detail), не ERP и не лендинг в кабинете.

---

## 2. Ветви → кабинет → SaaS-аналог

Не тащить shadcn / Sonner / Radix / «AI-glow». Live = `LbmCabinetsShell` + panes + `VedDetailDrawer` + `VedToast`.

| Ветвь | Кабинет | Главный job | SaaS-аналог job | As-is | Не делать |
|-------|---------|-------------|-----------------|-------|-----------|
| **1 Клиент** | `/cabinet` | Смета → тариф → PDF | Stripe Dashboard + простой customer portal | KPI; заявки + drawer `?id=`; pay CTA; PDF при `DONE` | Wizard из 8 шагов; chatbot; shipping CTA |
| **1** | `/cabinet/new` | Описать товар (D10) | Stripe Checkout: мало полей | NewCalc + attrs + upload + CSV + **progressive tips** ([`plan-newcalc-hints.md`](../../plan-newcalc-hints.md)) | LLM «угадай код» как кнопка |
| **1** | `/cabinet/support` | Спросить платформу | Zendesk/Intercom **customer** portal | FAQ + тред + Close/Reopen | Смешивать с чатом брокера |
| **2 Брокер** | `/broker/queue` | Взять оплаченную работу | Linear Triage / GitHub review queue | SLA; «для вас» / reserved | Unclaim без admin; SUPPORT inbox |
| **2** | `/broker/work` | QC кода и платежей | Linear issue + таблица | WorkMapping; HS autocomplete | Править `TariffPlan.priceRub` (D15) |
| **2** | `/broker/chat` | Дожать клиента по заявке | Front / Intercom teammate inbox | Threads + `waitingOn`; poll 45с | SSE в MVP; SUPPORT |
| **3 Admin** | `/admin` | Внимание платформы | Vercel / Stripe ops dashboard | Attention-лист | SUPER CMS в этом nav |
| **3** | `/admin/support` | Очередь ответов staff | Intercom **agent** inbox | Чипы + drawer + `SUPPORT_STATUS` | Brokers отвечают на SUPPORT |
| **3** | `/admin/bookings` | Карточка поверх списка | Linear/Notion master-detail | `VedDetailDrawer` | Второй тип drawer |
| Shared | все | Обратная связь | Linear toast | `VedToast` | `alert` / `confirm` / Sonner |

Git-источники UX: tag `ved-ui-cabinets-baseline` (D14) · `feat/chat-threads-devex` · PR #1 (`VedDetailDrawer`) · PR #2 (support archive).

---

## 3. Паттерны — канон (повторять)

| Паттерн | Где | Правило |
|---------|-----|---------|
| Master-detail + URL | orders / queue / work / bookings / clients / support | Список живёт; объект в drawer; deep-link |
| Drawer ≠ страница | `VedDetailDrawer` | Desktop справа; mobile fullscreen; Escape / backdrop |
| Status as pill | `StatusPill` + support chips | Не дублировать D8 на SUPPORT |
| Inbox vs archive | client/admin support | Unread только active |
| Чей ход | `waitingOn` | SUPPORT: `BROKER` = staff queue |
| Badge на nav | очередь, чат, support | Не отдельный колокольчик |
| Один профиль клиента | `/cabinet/profile` | `/settings` → redirect |
| Shipping скрыт | client nav | Flag; код не удалять |

**Empty state (M0.3):** заголовок что пусто + одно предложение почему + **одна** CTA. Язык D27 (просчёт / ТН ВЭД / брокер / PDF). Эталон: дашборд клиента, BrokersPane, QueuePane, ChatThreadsPane.

---

## 4. Очередь реализации кабинетов

Не мешать в один PR с ЮKassa / shipping / LLM-CTA.

| Порядок | Кабинет | Работа | Проверка |
|---------|---------|--------|----------|
| **1** | Клиент | D32 loading/error + SKU завода + heuristic top-N (C1–C4) | [`../plan-cabinets-d32.md`](../plan-cabinets-d32.md) |
| **2** | Брокер | Loading очереди ≠ pause; эталон завода read-only | plan B1–B3 **done** |
| **3** | Админ | D32 loading; фильтр `kind=MANUFACTURER`; poll orch/support | plan A1–A3 **done** |
| **4** | Супер-админ | CMS не расширять; SUPER скрыт; D32 на infra/сводке | plan S1–S4 **done** · D6/D28 |
| (live) | Производитель v1 | D31; спрос после клиентского C2 | [`../target-client.md`](../target-client.md) §производитель v1 |

Command palette (`Cmd+K`) — **hold** (§7).

---

## 5. Admin-nav — группы (канон к реализации)

Плоский список из 14 пунктов оставлять нельзя: плотность как у Vercel, без секций глаз теряется.  
Секции **видны сразу** (подписи в сайдбаре), не прятать пункты в аккордеон.

| Группа | Пункты |
|--------|--------|
| **Операции** | Дашборд · Заявки · Клиенты · Брокеры · Поддержка · Финансы |
| **Каталог** | Тарифы · ТН ВЭД · AI-качество |
| **Платформа** | Пользователи · Интеграции · Оркестрация · Журнал · Настройки |

Badge unread — на пункте «Поддержка», не на заголовке группы.

---

## 6. Кабинет производителя (D29) — v1

Flywheel: удобный импортёр → мелкие доходят до PDF/закупки → заводу есть смысл отдать эталон SKU → следующие просчёты не с нуля по весу/габаритам.  
Красивый кабинет завода **без** живого импортёра = пустая витрина.

**v1 (D31, live):** узкий partner-кабинет данных (аналог Stripe Connect / Shopify partner), не CRM и не маркетплейс.

| Экран | Зачем заводу | Связь с импортёром |
|--------|----------------|-------------------|
| Каталог SKU | Название, бренд, нетто/брутто, позже Д×Ш×В | Наследование в `CalculationItem.attrs` |
| «Как видит клиент» | Превью карточки в просчёте | Доверие |
| Спрос по SKU | Число просчётов / `DONE` (без ПДн) | KPI «хвост жив» |
| Сборные заказы | Очередь qty-запросов → OPEN пул → CONFIRMED | D34; не CRM email |
| Доступ | Только инвайт ADMIN | Как брокер: нет публичного signup (D25) |

Код: `src/components/ved/manufacturer/*`; роль `MANUFACTURER`; контейнер `containers/manufacturer` (:3004).

**Не в этом срезе:** оплата MOQ заводу, отгрузка сборной партии, закрытые чаты закупщиков, публичная витрина, «под ключ», Telegram как лицо. Канон: [`plan-consolidate-orders.md`](../plan-consolidate-orders.md).

Не обещать кабинет завода в текущем CTA лендинга (D27).

---

## 7. Command palette — hold

Linear `Cmd+K` окупается при сотнях объектов. Сейчас: клиент ~6 пунктов + header CTA; брокер 7; админ 14 — лечится **группами nav**, не палитрой.

Поиск **по сущности** (ТН ВЭД autocomplete, позже SKU завода) — да. Глобальный `Cmd+K` клиенту — нет. Вернуться, когда объектов станет много или админ явно не находит orch.

---

## 8. Empty states — конкретные дыры (M0.3)

| Экран | Live | Примечание |
|--------|--------|------|
| Клиент дашборд / заявки, 0 рядов | CTA «Создать просчёт» | Эталон — не ломать |
| Клиент брокеры, 0 | Объяснение + CTA | Эталон |
| Клиент баланс, пустой ledger | «Пока нет операций» + «Пополните, затем оплатите просчёт» + CTA «Пополнить» | `VedEmptyState` |
| Клиент заявки, фильтр без рядов | «Нет в этом фильтре» + CTA «Все заявки» | Не путать с нулевым списком |
| Support архив пуст | «Архив пуст» + «К активным»; без «создать» | `SupportPane` |
| Брокер очередь | Оплата vs `acceptingJobs` off — разный copy | `QueuePane` `paused` |
| Брокер чат | Ссылка в очередь (`queueHref`) | Эталон |
| Брокер dash, нет срочных | Ссылка в очередь / профиль | `VedEmptyState` |
| Admin support, папка пуста | Текст папки («Нужен ответ: новых нет»); без «создать тикет» | `SupportInboxPane` |
| Admin dash, всё спокойно | «Сейчас всё спокойно» + CTA «Заявки» + ссылка «Поддержка» | `DashboardPane` |
| Admin bookings, 0 / фильтр | «Заявок пока нет» vs «Нет в фильтре» + «Сбросить фильтр» | `BookingsPane` |
| Admin finance, выплаты | «Очередь выплат пуста» vs фильтр + «Все статусы» | `FinancePane` |
| Admin finance, компании | «Нет компаний» + hint /register | `FinancePane` |
| Admin orch | jobs/outbox пуст · нет FAILED + «Обновить» | `OrchPane` |
| Admin clients / brokers / audit / users | списки пусты — `VedEmptyState`, без лишних CTA | соответствующие panes |
| Admin clients drill-down | `VedDetailDrawer` + `?company=` (list остаётся) | `AdminCompanyDetailDrawer` |
| Admin integrations, recent | «Нет вызовов» | `IntegrationsPane` |

Копирайт: просчёт / ТН ВЭД / брокер проверит / PDF. Не «доставка», не «AI подберёт код сам», не «сообщество».

---

## 9. Live IA (сверить с кодом)

Header CTA клиента «Новый просчёт» (`/new`) — не пункт сайдбара.

| Роль | Live nav |
|------|----------|
| Клиент | Дашборд · Заявки · Брокеры · [Перевозка*] · Баланс · Поддержка · Профиль |
| Брокер | Дашборд · Очередь · В работе · Чат · SLA · Выплаты · Профиль |
| Админ | 14 пунктов, группы §5 в сайдбаре (мобильные chips плоские) |

\* только `NEXT_PUBLIC_SHIPPING_UI=1`.

---

## 10. Что не копируем

| Чужой паттерн | Почему не MVP |
|---------------|----------------|
| Linear `Cmd+K` | Мало типов объектов |
| Intercom на лендинге | D25 = `/login` `/register` |
| Notion-страницы | Фиксированная IA ролей |
| Slack/Telegram как inbox | D29: сеть не утекает в мессенджер как лицо |
| Enterprise mega-menu | Против D27 «не ERP» |
| Purple/AI-slop | D14 accent `#2b72f4` |

---

## 11. Проверка перед UI-PR кабинета

1. Ветвь 1 / 2 / 3 ясна; Prisma не в extract UI.
2. Паттерн §3 повторён или ADR почему нет.
3. [`../design-parity.md`](../design-parity.md) для экрана.
4. Holds D27: shipping CTA, LLM-кнопка, slim — выкл.
5. Очередь §4: не перескакивать кабинет производителя через красный клиентский empty state.
