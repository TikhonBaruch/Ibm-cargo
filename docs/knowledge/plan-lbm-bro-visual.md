# Исследование: визуальный формат lbm-bro

**D33.** Идея: принять (или отвергнуть по частям) предложенный визуал кабинетов **клиента, брокера и админа** из прототипа lbm-bro, не ломая domain MVP (D27) и baseline D14.

**Площадка:** `TikhonBaruch/Ibm-cargo` (продукт **LBM**).  
**Код прототипа:** `src/lbm-bro/` (~11.5k строк) + маршруты `app/client/*` + ассеты `public/lbm-bro/`.  
**Рабочий domain:** `/cabinet` + `/broker` + `/admin` + `/api/v1`.  
**Черновик до KB:** [`docs/plan-lbm-bro-skin.md`](../plan-lbm-bro-skin.md) (указатель сюда).

Индекс: [`README.md`](./README.md) · токены D14: [`design-baseline.md`](./design-baseline.md) · паттерны D32: [`design-patterns.md`](./design-patterns.md).

---

## 1. Идея и анализ

### 1.1 Что представил дизайнер

Не «форма нового просчёта в том же шелле», а **три кабинета с разным chrome**. Клиент — суперприложение (светлый product-shell). Брокер и админ — ops-шеллы одной семьи (тёмный ink; у админа фиолетовый mark). Live D14 сейчас сажает все три роли на один `VedShell`.

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

### 1.3 Три кабинета — предложенное визуальное решение

Дизайнер **развёл chrome по работе роли**. Общие токены; разные оболочки.

| Роль | Job | Shell в прототипе | SaaS-аналог | Live сейчас |
|------|-----|-------------------|-------------|-------------|
| **Клиент** | Выбрать модуль → просчёт → PDF | Светлый glass, цветные nav-тайлы, поиск + колокол + CTA | Superapp / customer portal | Тёмный `VedShell`, дашборд KPI |
| **Брокер** | Triage очереди → QC HS → чат → SLA | Тёмный ink, таблицы, KPI-stat, master-detail очереди | Linear triage | Тот же `VedShell`, очередь + WorkMapping |
| **Админ** | Платформа: assign, выплаты, toggles | Тёмный ink + **фиолетовый** brand-mark (`pulseRing`) | Vercel / Stripe ops | `VedShell` `markVariant=admin` + **группы** nav |

```text
                    токены D14 (#2b72f4, Manrope/Nunito, radius 28)
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   Client product shell   Broker ops shell     Admin ops shell
   .view-client .cl-*     .app .side           .app .side.admin
   light glass tiles      dark ink + tables    dark + purple mark
```

**Правило, которое стоит сохранить:** клиент не выглядит как админка. Брокер и админ — два ops-кабинета одной семьи.

### 1.4 Экраны прототипа — клиент

**Уже на `/client/*`, фазы A–B done:**

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

Lab-nav клиента (5 тайлов): Главная · Заявки · Справочник ТН ВЭД · Чат · Компания.  
Live-nav (`getClientNav`): Дашборд · Заявки · Производитель† · Брокеры · Перевозка† · Баланс · Поддержка · Профиль.

Брокеры / баланс / FAQ / гайд / перевозка / ТО в прототипе — **плитки главной или extra-роуты**, не пункты сайдбара. Это сознательная IA суперприложения.

### 1.5 Экраны прототипа — брокер

Компоненты `BrokerShell` + `broker-pages.tsx`. **Lab-маршрутов нет** — `href` смотрят на live `/broker` (не монтировать). Nav почти 1:1 с `getBrokerNav`.

| Lab экран | Компонент | Паттерн | Live `/broker` | Взять визуал? |
|-----------|-----------|---------|----------------|---------------|
| Дашборд | `BrokerDash` | 4× `.stat` + `alert-box` SLA + таблица «внимание» | KPI очередь/в работе/SLA + внимание | **да** (цифры — live) |
| Очередь | `BrokerQueue` | Master-detail: таблица claim + карточка HS/платежи/approve | `QueuePane` + `VedDetailDrawer`; claim отдельно от approve | оболочку **да**; approve оставить на `/work` (D8) |
| В работе | `BrokerWork` | Одна таблица №/клиент/SLA/статус | `WorkMapping`: позиции, attrs, HS autocomplete, dossier, extra fee, feedback | **нет** — demo слишком тонкий |
| Чат | `BrokerChat` | Один тред в `.card` + bubbles (+ voice stub) | Threads + split + unread badge | chrome bubbles **да**; список тредов — live |
| SLA | `BrokerSla` | Stats + bars «AI без правок / скорректировано» | Avg / % в срок / AI≠HS bars | **да** (уже близко) |
| Выплаты | `BrokerPay` | Таблица период/сумма/pill | `/payouts` ACCRUED/PAID | **да**; путь live = `/payouts`, не `/pay` |
| Профиль | `BrokerProfile` | Форма + `acceptingJobs` | то же + F21 pill | **да** |

Очередь в прототипе смешивает **взять** и **утвердить** на одном экране. В domain: claim только `QUEUED`/`SLA_RISK`; approve только `IN_REVIEW` (D8/D11). Карточку QC натягивать на `/work`, не на очередь.

Footer прототипа: «SLA ≤ 4 ч · рейтинг ★ · закрыто / нед» — совпадает с live F21.  
Лишнее: ссылка «→ Админ-панель», голос в чате, выдуманные 3.1 ч / 96%.

### 1.6 Экраны прототипа — админ

Компоненты `AdminShell` + `admin-pages.tsx`. Lab-маршрутов нет; `href` → live `/admin`. Nav **плоский, 9 пунктов** vs live **14–15 в трёх группах** (D28 / [`cabinets/ux-saas.md`](./cabinets/ux-saas.md) §5).

| Lab экран | Компонент | Live | Взять визуал? |
|-----------|-----------|------|---------------|
| Дашборд | 4 KPI + bar chart 7 дней + «внимание» + таблица заявок | live-счётчики, bar статусов, attention, open calc | chrome **да**; цифры только live (D14 запрет fake GMV) |
| Заявки | search + filter + таблица assign/escalate/PDF | `/bookings` + drawer `?id=` | таблица/фильтр **да** |
| Клиенты | KPI + таблица компания/тариф/баланс | `/clients` drill-down + ADJUSTMENT `?company=` | список **да**; drawer — live |
| Брокеры | `.person-card` сетка, approve/reject, SLA escalate | таблица + drawer + `acceptingJobs` | карточки **как доп. вид**; действия — live |
| Тарифы | 3 `.tariff-mini` Код/Таможня/Под ключ | EXPRESS/STANDARD/PRO, `priceRub`, share, SLA | карточки **да**; имена/цены — D10 |
| Финансы | GMV / комиссия / к выплате + очередь PAID | фильтр + CSV + mark PAID | layout **да**; GMV не выдумывать |
| AI-качество | модули OCR/Risk/Logistics + слайдер порога | confidence / SLA / `llmEnrichEnabled` | слайдер **да**; таблица «модулей vision» — hold |
| Audit | таблица актор/действие | read-only, без SUPER | **да** |
| Настройки | marketplace / autoAssign / maintenance + «2FA/шифрование» | `platform-gates` | toggles **да** если = live gates; 2FA/at-rest — не в MVP |

**Нет в прототипе, есть в live (не выкидывать):** Производители · Поддержка (staff inbox) · ТН ВЭД import · Пользователи · Интеграции · Оркестрация. Группы nav «Операции / Каталог / Платформа» — канон, lab их не рисует.

Лишнее: badge «48», «1284 просчётов», «2.1 млн ₽», «98% точность», ссылка «→ Кабинет клиента», security-театр 2FA.

### 1.7 Продуктовая модель дизайнера ≠ LBM

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

### 1.8 Что есть только в дизайне (hold)

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

### Клиент — брать product-shell

1. Superapp-главная: плитки модулей + лента с filter chips.  
2. Светлый glass-сайдбар и цветные nav-тайлы (не тёмный admin).  
3. Карточки заявок: обложка, pill, progress, «следующий шаг».  
4. Wizard как UX шагов (не как источник цифр/тарифов D10).  
5. `DesignerStub` на hold-модулях.

### Брокер — брать ops-polish, не выкидывать WorkMapping

1. Тёмный ink-шелл (уже ≈ `VedShell`): `.stats`, `alert-box` SLA, `.pill`.  
2. Карточка QC (HS + confidence + breakdown пошлина/НДС/сбор) — как визуал **work**, не очереди.  
3. SLA-bars «принято без правок / скорректировано».  
4. Профиль + `acceptingJobs`.

Не заменять `/work` demo-таблицей: live mapping, attrs, dossier, extra fee, feedback, HS autocomplete — канон QC.

### Админ — брать chrome, оставить 14 panes D28

1. Фиолетовый brand-mark (уже `markVariant=admin`); опционально `pulseRing` только в lab.  
2. Дашборд: 4 KPI + внимание + таблица (данные live).  
3. Карточки тарифов и person-card брокеров — как вид, не как единственный layout.  
4. Тoggles настроек **только** если они = `platform-gates`.

Не сплющивать nav до 9 пунктов. Не переносить fake GMV / «98%». Не выкидывать support / tnved / users / integrations / orch / manufacturers.

### Не брать в MVP (D27) — все роли

1. Тарифы Код/Таможня/Под ключ и пакеты 20/100 — без ADR.  
2. Freemium «1-й код бесплатно».  
3. Честный знак, ТО, голос, shipping CTA на главной.  
4. Браузерный classify и НДС 20% / сбор 15k как правда сметы.  
5. Proto-bar, fake KPI, ссылки «переключить роль» в prod.  
6. Перезапись live `/broker` / `/admin` компонентами lab.

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

Ручной чеклист (исследование, код — следующая задача):

| Роль | Что смотреть в прототипе | Не путать с live |
|------|-------------------------|------------------|
| Клиент | `/client` сетка, заявки-карточки, wizard, stubs ЧЗ/ТО | `/cabinet` — функция |
| Брокер | `broker-pages`: dash stats, queue master-detail, тонкий work | WorkMapping / claim≠approve |
| Админ | `admin-pages`: KPI, person-card, tariff-mini | 14 panes + группы nav; без fake GMV |

---

## 7. Статус

| Шаг | Статус |
|-----|--------|
| Импорт `src/lbm-bro` + `/client` | done (as-is) |
| Анализ в KB (клиент + брокер + админ) | **done (этот PR)** |
| Фаза C: broker/admin lab routes | next |
| Фаза D: domain wire | later |
| ADR cutover `/client` как prod-лицо | later, не молча |

**Одной фразой:** три кабинета на одних токенах D14: клиент = светлое суперприложение; брокер/админ = тёмный ops (админ — фиолетовый mark + группы nav live). Domain и инварианты не менять; lab брокера/админа отдельно от live; сшивка только через `/api/v1` и тарифы D10.
