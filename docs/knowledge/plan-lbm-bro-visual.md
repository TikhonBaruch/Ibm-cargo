# Исследование: визуальный формат lbm-bro

**D33.** Идея: принять (или отвергнуть по частям) новый клиентский визуал из прототипа lbm-bro, не ломая domain MVP (D27) и baseline D14.

**Площадка:** `TikhonBaruch/Ibm-cargo` (продукт **LBM**).  
**Код прототипа:** `src/lbm-bro/` (~11.5k строк) + маршруты `app/client/*` + ассеты `public/lbm-bro/`.  
**Рабочий domain:** `/cabinet` + `/broker` + `/admin` + `/api/v1`.  
**Черновик до KB:** [`docs/plan-lbm-bro-skin.md`](../plan-lbm-bro-skin.md) (указатель сюда).

Индекс: [`README.md`](./README.md) · токены D14: [`design-baseline.md`](./design-baseline.md) · паттерны D32: [`design-patterns.md`](./design-patterns.md).

---

## 1. Идея и анализ

### 1.1 Что представил дизайнер

Не «форма нового просчёта в том же шелле», а **суперприложение импорта**. Главная клиента — сетка модулей («Что сделаем?»), лента заявок и блок сопровождения груза. Кабинет клиента **не клон админки**: светлый glass-сайдбар, цветные nav-тайлы, поиск и баланс в шапке.

Брокер и админ в том же прототипе остаются **ops-шеллом**: тёмный ink-сайдбар, таблицы, KPI-карточки — ближе к D14 `VedShell`.

### 1.2 Канон визуала (токены = D14, язык = новый)

Цвета, шрифты и радиусы **совпадают** с [`design-baseline.md`](./design-baseline.md): `#2b72f4`, `#f5f7fa`, Manrope + Nunito, карточки ~28px. Новый формат — не новая палитра, а **IA + chrome клиента**.

| Слой | D14 live (`VedShell` / `/cabinet`) | lbm-bro (`/client`) |
|------|-------------------------------------|---------------------|
| Метафора | SaaS-кабинет: дашборд KPI + таблица заявок | Superapp: плитки модулей + лента «В работе» |
| Сайдбар клиента | Тёмный ink, как у брокера/админа | Светлый glass, цветные тайлы, баланс-чип |
| Nav клиента | Дашборд · Заявки · Брокеры · Баланс · Поддержка · Профиль | Главная · Заявки · Справочник ТН ВЭД · Чат · Компания |
| CTA | Header «Новый просчёт» | Header + hero-плитка «Определение кода ТН ВЭД» |
| Данные | Live `/api/v1` | `DemoProvider` (localStorage) |
| Proto-bar ролей | Запрещён в prod (D14) | Есть на `/client` (lab) |

CSS-канон клиента в прототипе явно подписан: *«Client cabinet: product shell, not admin clone»* (`src/lbm-bro/globals.css`).

### 1.3 Экраны прототипа

**Клиент (уже на `/client/*`, фазы A–B done):**

| Route | Компонент | Паттерн (D32) | Domain |
|-------|-----------|---------------|--------|
| `/client` | `ClientHome` | Superapp home / module grid + activity feed | Сетка живая; ЧЗ / ТО / shipping / freemium → `DesignerStub` |
| `/client/new` | `ClientWizard` | Multi-step wizard | Оплата/AI — demo-store; создание в БД — через `/cabinet` |
| `/client/orders` | `ClientOrders` | Card list + filter chips | Demo-лента |
| `/client/orders/[id]` | `ClientOrderPage` | Detail + stepper + upgrade tiles | Demo |
| `/client/tnved` | `ClientTnved` | Combobox / directory | Клиентский `tnved.json`; free peek → stub |
| `/client/chat` | `ClientChat` | Thread list + bubbles | Текст demo; голос → stub |
| `/client/balance` | `ClientBalance` | Ledger list + topup | Demo баланс |
| `/client/brokers` | `ClientBrokers` | Person cards | UI выбора; domain = очередь после pay (D11) |
| `/client/company` | `ClientCompany` | Settings form | Demo профиль |
| `/client/faq` · `/guide` | extra | Content | Copy |
| `/client/ship` · `/clearance` | extra | Service pages | **Hold D27** (shipping UI off; ТО нет) |

**Брокер / админ (компоненты есть, маршрутов lab нет):**  
`BrokerShell` / `BrokerDash|Queue|Work|Chat|Sla|Pay|Profile` и `AdminShell` / `AdminDash|Orders|Clients|Brokers|Tariffs|Finance|Ai|Audit|Settings` в `src/lbm-bro/components/`. Сейчас `href` смотрят на live `/broker` и `/admin` — **не монтировать поверх domain**. Фаза C: только `/lab/broker` и `/lab/admin`.

### 1.4 Продуктовая модель дизайнера ≠ LBM

#### Тарифы

| Дизайн | Цена | Смысл | LBM (D10) |
|--------|------|-------|-----------|
| Код | 990 ₽, 1-й бесплатно | Только HS | Нет freemium-гейта |
| Таможня | 2990 | HS + пошлина/НДС, без брокера | Ближе к EXPRESS (AI only) |
| Под ключ | 5990, брокер ≤4ч | HS + платежи + QC | STANDARD/PRO + queue |
| Пакеты m20 / m100 | до 20 / 100 позиций | Мульти из файла | EXPRESS 1 / STANDARD 3 / PRO 10 |

Дизайнер хотел воронку «бесплатный код → апгрейд Таможня/Под ключ» (`UpgradeTile` на карточке заявки). В LBM пакет — это `TariffCode`, не апгрейд с карточки.

#### Статусы заявки

| Дизайн | D8 live |
|--------|---------|
| `draft → pay → ai → ready → broker → done` | `AI_PROCESSING → AI_READY → QUEUED → IN_REVIEW → DONE` (+ `SLA_RISK`) |
| Фильтры ленты: Все / Оплата / ТН ВЭД / В работе / Готово | `/cabinet/orders`: Все / Готово / У брокера / Оплата |

Маппинг при сшивке (фаза D), не переименовывать enum Prisma «под дизайн».

#### Платежи в прототипе (не канон)

| | lbm-bro demo | Domain LBM |
|--|-------------|------------|
| НДС | **20%** (`payments.ts`) | **22%** с 01.01.2026 ([`customs-payments.md`](./customs-payments.md)) |
| Сбор | константа **15 000 ₽** | шкала ПП **1637** |
| Пошлина | глава × грубый `%` в браузере | heuristic / корпус / broker override |
| Классификация | `tnved.json` + aliases **в браузере** | server + LLM fail-open; UI не зовёт matrix |

Цифры прототипа **не** показывать как смету продукта.

### 1.5 Что есть только в дизайне (hold)

| Модуль | Замысел | Domain |
|--------|---------|--------|
| Честный знак | Маркировка в заявке, плитка на главной | Нет продукта |
| Таможенное оформление (ТО) | Декларация / выпуск после кода | Нет модуля |
| Голос в чате | Voice bubbles / recorder | Текст |
| 1-й HS бесплатно | Freemium peek | Нет (D11: брокер только после оплаты) |
| Proto-bar ролей | Админ / Клиент / Брокер | Запрещён в prod (D14) |
| Shipping на главной | LTL/FTL CTA | Domain есть, UI default **off** (D27) |
| Fake GMV / «1284 просчётов» | Admin dash | D14: данные только live |

Пересечение с domain (можно натянуть визуал позже): create calc, pay, queue/claim, chat text, balance/ledger, PDF, HS search, broker QC, attrs/upload/CSV.

---

## 2. Структура (как устроено в репо)

```text
src/lbm-bro/
  globals.css              # токены + client superapp + ops shell + stubs
  components/
    client-shell           # светлый сайдбар + search + bell + CTA
    client-home            # сетка модулей + feed + DesignerStub
    client-wizard          # /new — OCR/clarify/тарифы/PDF demo
    client-orders          # карточки + chips
    client-order-page      # деталь + upgrade + payments form
    client-tnved           # справочник
    client-extra           # FAQ, guide, balance, chat, brokers, ship, clearance, company
    designer-stub          # бейдж «Замысел дизайнера» — не тихий noop
    proto-bar              # lab switcher /client|/cabinet|/broker|/admin
    broker-* / admin-*     # ops-визуал, не привязан к app routes
  lib/
    store.tsx              # DemoProvider — НЕ domain
    tariffs / payments / clarify-ai / tnved-lookup / order-pdf …
public/lbm-bro/            # SVG covers, avatars, tnved.json
app/client/**              # Next routes UI lab
```

**Ownership:** визуал lab — `src/lbm-bro` + `app/client`. Domain и extract UI — по-прежнему `src/components/ved/*` + `/cabinet|/broker|/admin` ([`branches.md`](./branches.md), D16/D17). Нет `@prisma/client` в lab (ok).

**Доступ:** `homePathForRole(CLIENT) = "/client"`; `/cabinet` остаётся рабочим fallback. Proto-bar и demo-store на дефолтном лендинге клиента — **риск prod**, пока фаза D не сшита.

---

## 3. Что брать в продукт (решение исследования)

### Брать визуал (клиент)

1. Superapp-главная: плитки модулей + лента заявок с filter chips.  
2. Светлый product-shell клиента (не копировать тёмный admin).  
3. Карточки заявок с обложкой товара, pill статуса, progress.  
4. Wizard как UX-паттерн шагов (не как источник цифр/тарифов).  
5. `DesignerStub` как честный маркер hold-модулей — сохранять, пока нет ADR.

### Не брать в MVP (D27)

1. Тарифы Код/Таможня/Под ключ и пакеты 20/100 — без ADR.  
2. Freemium «1-й код бесплатно».  
3. Честный знак, ТО, голос, shipping CTA на главной.  
4. Браузерный classify и НДС 20% / сбор 15k как правда сметы.  
5. Proto-bar и fake GMV в prod.  
6. Перезапись `/broker` / `/admin` компонентами lab.

### Сшивка (не визуал)

Маппинг при фазе D:

| Дизайн | Domain |
|--------|--------|
| Код | EXPRESS (без очереди брокера при high conf) |
| Таможня | EXPRESS + смета платежей в PDF (без QUEUED) **или** оставить EXPRESS как есть |
| Под ключ | STANDARD / PRO → pay → QUEUED |
| `pay` | `AI_READY` + pay CTA |
| `broker` | `QUEUED` / `IN_REVIEW` |
| `done` | `DONE` + PDF |

Точные цены — `TariffPlan.priceRub`, не константы `TARIFF_RUB` из прототипа.

---

## 4. План фаз (после этого исследования)

Код `src/` / `app/` по этому плану — только со следующей задачей; этот PR = KB.

| Фаза | Что | Не делать |
|------|-----|-----------|
| **A–B** | Клиентский lab `/client/*` + stubs | **done** |
| **C** | Lab `/lab/broker` и `/lab/admin`: тот же CSS, `DesignerStub` на fake KPI, proto-tab. Поправить `href` shells с `/broker`/`/admin` на lab-пути | Не монтировать на live `/broker`/`/admin` |
| **D** | Адаптер `DemoProvider` → `/api/v1` (list/create/pay/chat). Тарифы D10. Убрать stubs по мере готовности | Не менять D8/D10/D11 «ради красоты» |
| **E** | Если lab станет prod-лицом клиента: ADR (D14/D32), `homePathForRole` осознанно, proto-bar **off**, smoke `/client` + `smoke:mvp` | Не `Vercel Root=lbm` — канон Root **`.`** ([`deploy.md`](./deploy.md)) |

Старый черновик писал «Root Directory = lbm» — **устарело** после hoist Next в корень.

---

## 5. Риски (зафиксировать до кода)

1. **Второй визуальный язык (D32).** Lab на `/client` vs `VedShell` на `/cabinet` — сознательный split. Prod-cutover требует ADR, иначе два chrome у одной роли.  
2. **Клиент уже падает на lab.** `homePathForRole("CLIENT") → /client`. Demo login показывает localStorage, не Postgres. `/cabinet` надо оставлять в proto-bar и в copy, пока нет фазы D.  
3. **Инварианты.** Wizard demo может имитировать «отправку брокеру» без оплаты — в domain это запрещено (D11). Сшивка только через pay.  
4. **Extract.** `containers/client` копирует `ved/client`, не `src/lbm-bro`. Lab не в Docker UI, пока нет отдельного решения.  
5. **Admin lab** содержит выдуманные GMV — в lab подписать stub, в prod не переносить.

---

## 6. Проверка (когда пойдёт код)

| Шаг | Критерий |
|-----|----------|
| Structure | Этот файл в `test:structure` |
| Lab клиент | `/client` рендерит сетку; stubs видимы; `/cabinet` жив |
| Фаза C | `/lab/broker` и `/lab/admin` не перекрывают domain; proto-bar ведёт в lab |
| Фаза D | create/pay/PDF идут в `/api/v1`; статусы D8; НДС 22% / сбор 1637 |
| Prod | нет proto-bar; нет fake KPI; `smoke:mvp` зелёный |

Ручной чеклист клиента lab (сейчас): Главная → Заявки → карточка → Новый просчёт → Справочник → Чат (голос = stub) → `/cabinet` как функция.

---

## 7. Статус

| Шаг | Статус |
|-----|--------|
| Импорт `src/lbm-bro` + `/client` | done (as-is) |
| Анализ в KB (этот файл) | **done (этот PR)** |
| Фаза C: broker/admin lab routes | next |
| Фаза D: domain wire | later |
| ADR cutover `/client` как prod-лицо | later, не молча |

**Одной фразой:** новый визуал — суперприложение клиента на тех же токенах D14; domain и инварианты не менять; брокер/админ lab отдельно от live кабинетов; сшивка только через `/api/v1` и тарифы D10.
