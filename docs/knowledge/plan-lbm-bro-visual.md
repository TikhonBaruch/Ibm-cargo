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

Не «форма нового просчёта в том же шелле», а **три кабинета с разным chrome**. Клиент — суперприложение (светлый product-shell). Брокер и админ — ops-шеллы одной семьи (тёмный ink; у админа фиолетовый mark). Live D14 сейчас: клиент = `LbmCabinetsShell` product-shell; брокер/админ = тот же файл, ops-шелл. `VedShell` — производитель + shared `api`/`VedEmptyState`/`StatusPill`.

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
Live-nav (`getClientNav`): Главная · Заявки · Справочник ТН ВЭД · Чат · Компания. Брокеры / баланс / FAQ / гайд / перевозка / ТО / производитель — плитки главной или extra-роуты.

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

**Доступ:** login CLIENT → `/cabinet` (live product-shell + `/api/v1`). `homePathForRole("CLIENT")` = `/cabinet`. Lab `/client` остаётся референсом (demo-store). Proto-bar только в lab.

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

| Фаза | Что | Не делать |
|------|-----|-----------|
| **A–B** | Клиентский lab `/client/*` + stubs | **done** |
| **C** | **Live chrome:** `LbmCabinetsShell` на `/cabinet` `/broker` `/admin`. Клиент = product-shell + superapp home (`ClientSuperappHome`). Брокер/админ = ops-шелл вокруг существующих panes. Данные только `/api/v1` | Не монтировать prototype `BrokerShell`/`AdminShell`; не сплющивать admin nav; не выкидывать WorkMapping; нет proto-bar и fake GMV |
| **C2** | **Pane visual:** карточки заявок, wizard chrome на `/new`, stepper на детали, очередь `.card`/`table.data`, QC-шапка WorkMapping, person-card брокеров, `tariff-mini` D10. Hold-модули → `DesignerStub` | Не копировать Код/Таможня/Под ключ, freemium, ЧЗ/ТО/голос, НДС 20%/сбор 15k, браузерный classify; не дробить NewCalc на шаги, скрывающие `HsCodeAutocomplete`/`FieldSuggest`; claim ≠ approve |
| **C3** | **Максимальный match макета:** live-nav клиента = 5 тайлов (Главная · Заявки · Справочник ТН ВЭД · Чат · Компания); шапка = поиск + колокол + CTA; главная = greet/quick/ЧЗ-expand + faq/guide + lookup + лента с covers/chips/progress + svc. Extra-роуты `/cabinet/{tnved,faq,guide,clearance}`. Balance/чат/компания/брокеры — chrome макета. Hold → `DesignerStub`. Иконки — `@/lbm-bro/components/icon`. Shipping/factory не в сайдбаре (плитки/deep-link). | Не брать `tnved.json` как правду (live = `/api/v1/tnved/search`); не копировать freemium/Код-Таможня-Под ключ/НДС 20%/сбор 15k/голос/ЧЗ/ТО как продукт; не сплющивать admin nav; WorkMapping не заменять |
| **C4** | **Остатки внутренней вёрстки:** панели, которые после C3 всё ещё на VedShell-карточках (`rounded-[28px]`, `rounded-xl` инпуты, slate-чат). CSS-мост `.lbm-live-*` + markup `.stats` / `table.data` / `.field` / `.chat-box` / `.search-row` / `.filter-chips` / `.activity-list`. | Не менять D8/D10/D11; не сплющивать admin nav; WorkMapping не заменять; кабинет производителя (`VedShell`) вне скоупа |
| **C5** | Бейдж hold скрыт: `DesignerStub` → `null` (title/intent остаются на call sites + комментарий restore). Hint `/login` = client / broker / admin | Не удалять call sites и seed-учётки |
| **C6** | Chrome производителя скрыт в визуале: плитка «Производитель» на главной, admin nav, фильтр в «Клиентах». `designerManufacturerChromeEnabled()` = `false`. Код/роуты живые | Не выключать `FACTORY_UI`, не удалять pane `/factory` |
| **C7** | `manufacturerName` временно **не** required на create (поле остаётся). Restore: вернуть ключ в `hasRequiredCreateAttrs` | Не убирать поле из формы; origin + composition остаются R |
| **C8** | Честные stub + скрыть инвойс/qty/вес. [`plan-lbm-bro-honest-skin.md`](./plan-lbm-bro-honest-skin.md) | Не выдумывать KPI; не менять API required; цена тарифа и пошлина/НДС остаются |
| **C9** | Скрыть блок «Замысел дизайнера» (`DesignerStub` → `null`, бейдж `.is-stub` off). Инвойс/qty/вес как в C8 | Не удалять call sites |
| **C10** | `/cabinet/new` = точная копия шага «Что ввозите?» макета. Остальной create-UI скрыт. [`plan-lbm-bro-newcalc-mock.md`](./plan-lbm-bro-newcalc-mock.md) | Не менять D8/D10/D11; 0 ₽ только chrome |
| **C11** | Клик «Мультипозиция» на `/cabinet/new` = экран lab (модалка файла, карточки пакета). [`plan-lbm-bro-newcalc-multipack.md`](./plan-lbm-bro-newcalc-multipack.md) | Не менять D10 caps 1/3/10; не charge 3990/20 |
| **C12** | Single `/cabinet/new`: панель «Уточняем для точности кода» (lab clarify) после описания + страна. [`plan-lbm-bro-newcalc-clarify.md`](./plan-lbm-bro-newcalc-clarify.md) | Не на `/cabinet/tnved`; не в multi; heuristic не переписывать |
| **C13** | Stepper заявки: зазор «1 Товар 2 Оплата 3 Брокер 4 PDF». Drawer порталится в `body` (вне `.view-client`) — CSS labeled не жил | Не менять D8 шаги; не трогать broker/admin drawers |
| **C14** | На карточке заявки показать страну происхождения (header + ТН ВЭД блок). Селект create — полный каталог `ORIGIN_COUNTRIES`, не 6 пунктов | Не менять API required; не выдумывать страну если её нет |
| **C15** | Карточка заявки = страница `/cabinet/orders/[id]` (chrome lab 47892). Drawer off. Hold: upgrade / payments form / ship-ТО. [`plan-lbm-bro-order-page.md`](./plan-lbm-bro-order-page.md) | Не НДС 20%; не Код/Таможня/Под ключ domain; не «передать брокеру» без оплаты |
| **D** | Адаптер lab `DemoProvider` → `/api/v1` (если lab ещё нужен). Тарифы D10. Убрать stubs по мере готовности | Не менять D8/D10/D11 «ради красоты» |
| **E** | Lab `/client` остаётся референсом. Prod-лицо клиента = `/cabinet` (`homePathForRole` + login). Proto-bar **off** на live | Не `Vercel Root=lbm` — канон Root **`.`** ([`deploy.md`](./deploy.md)) |

Пользователь явно попросил пересобрать **живые** кабинеты в формате визуала — фаза C смещена с `/lab/broker|/lab/admin` на live routes. Lab `/client` не удаляем.

Старый черновик писал «Root Directory = lbm» — **устарело** после hoist Next в корень.

---

## 5. Риски (зафиксировать до кода)

1. **D32.** Live теперь использует chrome прототипа (`LbmCabinetsShell`), не второй `VedShell` у тех же ролей. `VedShell` остаётся для производителя и как источник `VedEmptyState` / `api` / `StatusPill`.
2. **CSS прототипа** (`globals.css`) содержит неscoped `* { margin:0 }` и `button { background:none }`. На live окутываем `.lbm-bro-root`; Tailwind utilities должны побеждать. Лендинг CSS не грузит, пока пользователь не зашёл в кабинет (Next бандл).
3. **Инварианты.** Superapp-плитки ведут на live `/new` `/orders` `/support`. Нет «отправки брокеру» без оплаты.
4. **Extract.** `containers/{client,broker,admin}` резолвят `@/*` → `src/*`; `LbmCabinetsShell` тянет `src/lbm-bro/globals.css` + `icon`. Host/standalone trace должен включить эти файлы.
5. **Admin KPI** — только live counts. Нет «1284» / «2.1 млн ₽».

---

## 6. Проверка (когда пойдёт код)

| Шаг | Критерий |
|-----|----------|
| Structure | Этот файл в `test:structure` |
| Live клиент | `/cabinet` — 5 тайлов + поиск/колокол/CTA; главная = сетка макета; shipping/factory не в сайдбаре; hold → stub-роуты; factory/new/chat — `.card`/`.field`/`.chat-box` |
| Live брокер | `/broker` — тёмный ops; dash `.stats` + SLA alert; `/work` = WorkMapping; `/sla` `/payouts` `/profile` `/chat` — прототип-хром |
| Live админ | `/admin` — ops + фиолетовый mark; группы nav 14 panes; KPI live; bookings/clients/finance/users — `.card` + `table.data` |
| Lab | `/client` референс (demo-store); proto-bar только там |
| Domain | create/pay/PDF через `/api/v1`; статусы D8; НДС 22% / сбор 1637 |
| Prod | нет proto-bar на `/cabinet|/broker|/admin`; нет fake KPI; `smoke:mvp` зелёный |

Ручной чеклист:

| Роль | Куда смотреть | Не путать |
|------|---------------|-----------|
| Клиент | `/cabinet` superapp + `/cabinet/orders` таблица | `/client` — lab demo |
| Брокер | `/broker` stats/queue; QC на `/work` | claim ≠ approve |
| Админ | `/admin` KPI live + группы nav | 9 плоских пунктов прототипа |

---

## 7. Статус

| Шаг | Статус |
|-----|--------|
| Импорт `src/lbm-bro` + `/client` | done (as-is) |
| Анализ в KB (клиент + брокер + админ) | done |
| Фаза C: live chrome (`LbmCabinetsShell`) | **этот PR** |
| Фаза C2: pane visual + `DesignerStub` | **этот PR** |
| Фаза C3: 5-tile IA + шапка макета + extra-роуты + stub hold | **этот PR** |
| Фаза C4: leftover inner panes → `.card` / `.stats` / `table.data` / `.field` / `.chat-box` | **этот PR** |
| Фаза C5: бейдж hold скрыт (`DesignerStub` → `null`); hint `/login` = client / broker / admin | superseded C8, restored C9 |
| Фаза C6: chrome производителя скрыт в визуале (`designerManufacturerChromeEnabled` = false) | **этот PR** |
| Фаза C7: `manufacturerName` optional на create | **этот PR** |
| Фаза C8: честные stub + скрыть инвойс/qty/вес | **этот PR** · [`plan-lbm-bro-honest-skin.md`](./plan-lbm-bro-honest-skin.md) |
| Фаза C9: блок «Замысел дизайнера» скрыт | **этот PR** |
| Фаза C10: `/cabinet/new` = копия шага «Что ввозите?» | **этот PR** · [`plan-lbm-bro-newcalc-mock.md`](./plan-lbm-bro-newcalc-mock.md) |
| Фаза C11: клик «Мультипозиция» = пакетный экран макета | **этот PR** · [`plan-lbm-bro-newcalc-multipack.md`](./plan-lbm-bro-newcalc-multipack.md) |
| Фаза C12: single `/cabinet/new` панель уточнений (lab clarify) | **этот PR** · [`plan-lbm-bro-newcalc-clarify.md`](./plan-lbm-bro-newcalc-clarify.md) |
| Фаза C13: зазор в stepper заявки (`1 Товар`, не `1Товар`) | **этот PR** |
| Фаза C14: страна происхождения на карточке заявки | **этот PR** |
| Фаза C15: заявка = страница lab 47892, не drawer | **этот PR** · [`plan-lbm-bro-order-page.md`](./plan-lbm-bro-order-page.md) |
| Фаза D: lab → `/api/v1` | later |
| ADR cutover lab как единственное prod-лицо | не нужно: prod = `/cabinet` |

**Одной фразой:** live `/cabinet` повторяет IA и chrome макета; hold-модули на месте, блок «Замысел дизайнера» скрыт (C9); инвойс/qty/вес временно скрыты; `/cabinet/new` шаг «Что ввозите?» (C10) + клик «Мультипозиция» (C11, D10 caps) + панель уточнений на single (C12, lab heuristic); stepper заявки с зазором «1 Товар» (C13); страна происхождения на карточке заявки (C14). Domain D8/D10/D11/D15 и live ТН ВЭД не менять.

### C9 — скрыть «Замысел дизайнера»

`DesignerStub` снова `return null` (как C5). Бейдж `.go-tile.is-stub::after` выключен. Call sites и плитки hold остаются. Restore: aside в `designer-stub.tsx`.

### C8 — честные stub + скрыть инвойс / qty / вес

Исторически C8 вернул видимый бейдж. **C9 снова скрыл.** Слоты ЧЗ / ТО / freemium / сопровождение на главной занимают место макета без note-блока.

`commercialInvoiceUiEnabled()` = `false`: в UI нет стоимости партии, количества, цены единицы, нетто. Default create больше не шлёт `18000`. Цена **тарифа** и пошлина/НДС остаются. Смета «без доставки» в этом режиме показывает только платежи (не инвойс→ТС). Restore флага: `return true`.

### C7 — производитель на create необязателен

Поле `manufacturerName` остаётся в NewCalc / quick-calc. Hard-reject и UI-gate требуют только `originCountry` + `composition`. Restore: вернуть `manufacturerName` в `hasRequiredCreateAttrs` / `missingRequiredCreateAttrs` (и зеркало `containers/api`).

### C6 — chrome производителя скрыт в визуале

Макет lbm-bro **не** рисовал кабинет/плитку производителя. Live extra (FACTORY_UI) светил её на суперприложении и в admin nav. Временно прячем chrome: `designerManufacturerChromeEnabled()` возвращает `false` (restore = `factoryUiEnabled`). Плитка на `ClientSuperappHome` закомментирована. Код `/cabinet/factory`, `/admin/manufacturers`, attrs «производитель» в NewCalc — без удаления.

### C5 — бейдж hold скрыт

Показ «Замысел дизайнера» скрыт (C9 = C5 `return null`). Публичный `/login` показывает только client / broker / admin.

### C13 — зазор в stepper заявки

`VedDetailDrawer` порталит OrderDetail в `document.body`, вне `.view-client`, поэтому `.view-client .wiz-steps.labeled button { gap: 6px }` не жил: `1Товар2Оплата3Брокер4PDF`. На `.order-full` добавлен `view-client`; подпись в `<span class="wiz-step-lab">`; live CSS `inline-flex` + `gap: 0.4em`.

### C14 — страна происхождения на заявке

На live OrderDetail страна была только в нижнем card (`Страна:`) и часто как ISO. Показать **Страна происхождения · Китай** под заголовком и в блоке ТН ВЭД (`originCountryRuLabel` из `field-suggest`: calc.country или `items[0].attrs.originCountry`). Селект `/cabinet/new` берёт тот же каталог, плюс «ЕС».

### C15 — заявка отдельной страницей (lab 47892)

Drawer снят. Live `/cabinet/orders/[id]` копирует chrome `ClientOrderPage`: timeline точек, HS+cover, facts, документы, aside next/платежи/брокер/события. Upgrade / payments-form / Перевозка-ТО — слоты с disabled CTA. Цифры — НДС 22% / ПП 1637. Канон: [`plan-lbm-bro-order-page.md`](./plan-lbm-bro-order-page.md).

### C4 — leftover inner panes

C3 закрыл шелл, суперприложение и часть extras. Внутри кабинетов остались VedShell-карточки (`rounded-[28px] border-black/[0.04]`, `rounded-xl` инпуты, `bg-slate-50` чат) рядом с уже натянутыми `.card` / `table.data`.

| Live pane | Chrome после C4 | Не копировать |
|-----------|-----------------|---------------|
| `/cabinet/factory` | `.card` + `.field` + `table.data` | завод-кабинет производителя (`VedShell`) |
| `/cabinet/new` поля + баннер create | `.field` + `.card` / `.alert-box` | шаг «Бесплатно», пакеты 20/100 |
| OrderChat / WorkChat / support thread | `.chat-box` + `.bubble` + `.chat-row` | голос |
| `/broker/sla` | `.stats` + `.breakdown` live (не 3.1ч/96%) | фейковый рейтинг 4.9 |
| `/broker/payouts` | `.stats` + `table.data` + pill ACCRUED/PAID | «30–40% от просчёта» как копирайт макета |
| `/broker/profile` + `/chat` | `.card` + `.field` / `.activity-list` | — |
| `/admin/bookings` `/clients` `/finance` | `.card` + `.search-row` + `table.data` + live `.stats` | fake GMV / 842 клиентов |
| `/admin/users` `/audit` `/support` `/settings` `/integrations` `/orch` `/manufacturers` `/tnved` | `.card` / `.field` / `table.data` / `.activity-list` | 9 плоских пунктов прототипа |

CSS-мост в `lbm-cabinets-live.css` подтягивает оставшиеся `rounded-[28px]` / `rounded-xl` внутри `.lbm-live-client` / `.lbm-live-ops` (кроме прозрачных `.cl-search` / `.im-search`).

### C3 — IA и chrome макета на live

Макет (`ClientShell` + `ClientHome`) — суперприложение, не SaaS-меню из 6–8 пунктов. C2 натянул карточки/wizard/stepper, но оставил старую IA и Lucide — визуально «не то».

| Слой | Макет | Live после C3 |
|------|--------|----------------|
| Сайдбар | Главная · Заявки · Справочник ТН ВЭД · Чат · Компания | те же 5 тайлов → `/cabinet` `/orders` `/tnved` `/support` `/profile` |
| Шапка | поиск + колокол + «Новый просчёт»; title скрыт на home/wizard/order | то же; order live = drawer, title на `/orders` остаётся |
| Главная | greet + consult/ЧЗ + freemium stub + faq/guide + lookup + feed covers/chips + svc | `ClientSuperappHome` клон разметки; данные live D8 |
| Extra | `/faq` `/guide` `/tnved` `/clearance` `/ship` | те же пути под `/cabinet/*`; ship live только при флаге, иначе stub |
| Справочник | `tnved.json` + «1-й бесплатно» | `GET /api/v1/tnved/search` + `DesignerStub` freemium |
| FAQ/гайд | тарифы Код/Таможня/Под ключ | copy D10 (EXPRESS 1 / STANDARD 3 / PRO 10), НДС 22% / сбор 1637 |
| Иконки | `lbm-bro/components/icon` | то же на live chrome (не Lucide) |

Брокеры / баланс / перевозка / производитель / ТО — **плитки главной или extra**, не пункты сайдбара. Флаги `SHIPPING_UI` / `FACTORY_UI` по-прежнему включают **живые** deep-link экраны, не тайлы меню.

**Не копировать (stub):** ЧЗ, ТО, голос, freemium peek, пакеты 20/100, НДС 20% / сбор 15k, браузерный classify, proto-bar, fake GMV, «→ Админ».

### C2 — что натянуто / что stub

| Live pane | Chrome | Не копировать из макета |
|-----------|--------|-------------------------|
| `/cabinet/orders` | `.cl-order-grid` + filter chips | фильтры ТН ВЭД / draft прототипа |
| `/cabinet/new` | `.wiz-steps` товар→тариф→запуск; `tariff-mini` D10 | шаги «Бесплатно» / пакеты 20/100; скрытие HS combobox |
| OrderDetail | stepper D8 + `.order-hs` live | UpgradeTile Код/Таможня/Под ключ; НДС 20%; сбор 15k |
| `/broker/queue` | `.card` + `table.data` | approve на очереди |
| `/broker/work` | QC metric/breakdown **над** WorkMapping | тонкая demo-таблица вместо mapping |
| `/admin/brokers` | `.person-card` | фейковый SLA 3.1 ч |
| `/admin/tariffs` | `.tariff-mini` EXPRESS/STANDARD/PRO | имена Код/Таможня/Под ключ |
| Superapp home | C3: разметка `ClientHome` + live feed | кликабельный ЧЗ/ТО как продукт; `tnved.json` |
