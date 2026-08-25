# План MVP polish (без логистики / LLM / эквайринга)

Канонический поэтапный план доводки продукта после стабилизации.  
As-is: [`current-app.md`](./current-app.md) · дорожная карта: [`roadmap.md`](./roadmap.md) · данные: [`data-model.md`](./data-model.md) · parity UI: [`design-parity.md`](./design-parity.md).  
**Продуктовый фокус:** частный заказчик ТН ВЭД → брокер-QC → PDF (**D27** / [`product.md`](./product.md)); без обещания «доставка под ключ» в текущем скоупе.

**Дата:** 2026-08-05.

## Скоуп

### Входит

- Выкат D24 (attrs / ТН ВЭД scaffold / `CalculationEvent`)
- UI parity кабинетов: чат брокера, support/settings, SLA/thumbs/escalate
- Продуктивизация D24: search ТН ВЭД, attrs в create, timeline событий
- Notify email на prod (Resend/SMTP) — **не** эквайринг
- Dual-path parity Next ↔ `containers/api`; опционально C5 gate

### Вне скоупа (явно)

| Тема | Куда отложено |
|------|----------------|
| Логистика / shipping UI / carrier API | [`growth.md`](./growth.md) §Перевозка · roadmap §2.2 / §3.4 |
| LLM enrich | [`growth.md`](./growth.md) §Реальный AI · roadmap §3.3 — **backend partial** (compose/local: corpus lookup-v1, `smoke:chain-llm`); **не** polish UI / client CTA |
| Внешний платёжный узел (ЮKassa host) | [`growth.md`](./growth.md) §Эквайринг · roadmap §3.1 |
| Mobile app, OCR, AI Risk, freemium | [`product.md`](./product.md) vision |

Mock topup (`ALLOW_MOCK_TOPUP`) и heuristic-v1 **остаются** рабочим путём MVP.

## Стратегия

1. Сначала зафиксировать и выкатить уже сделанное (D24).
2. Закрыть UI parity (чат → support/settings → SLA/thumbs).
3. Довести справочник ТН ВЭД + attrs/events в UI поверх D24.
4. Notify email и dual-path/C5 — после стабильного polish.
5. Dual-path: мутации create/pay/claim/map/approve → Next **и** `containers/api` ([`skeleton.md`](./skeleton.md)).
6. Gate этапа: `npm run test:ci` → preview/prod smoke (`mvp` / `full` / `broker` / `chat` / `sla`).

```text
0 push/deploy D24
  → 1A chat merge
  → 1B support/settings ║ 1C SLA/thumbs/escalate
  → 2A tnved API → 2B attrs UI → 2C broker autocomplete → 2D events UI
  → 3 notify (∥ можно с 1C)
  → 4 dual-path / C5 gate (не блокер polish)
```

---

## Матрица приоритизации фич

Скоуп той же границы: **без** логистики, LLM, внешнего эквайринга.  
Шкалы: **Impact** (ценность для idea-check / брокера / клиента) и **Effort** (дни–недели, dual-path учтён) — 1 низкий … 5 высокий.  
**Score** = Impact × (6 − Effort) — выше = делать раньше.  
**MoSCoW** относительно цели «MVP polish закрыт» ([критерии](#критерии-mvp-polish-закрыт)).

### Сводная таблица

| ID | Фича | Ветка | Impact | Effort | Score | MoSCoW | Этап плана | Зависимости |
|----|------|-------|--------|--------|-------|--------|------------|-------------|
| F01 | Push/deploy D24 на Vercel | Ядро | 5 | 1 | 25 | Must | **0** | commit на `main` |
| F02 | Список тредов чата (broker) | 2 | 5 | 2 | 20 | Must | **1A** | merge `feat/chat-threads-devex` |
| F03 | DevEx setup / `.nvmrc` | Ops | 3 | 1 | 15 | Should | **1A** | с F02 |
| F04 | Thumbs `mediaUrl` в work | 2 | 4 | 2 | 16 | Must | **1C** | upload/S3 уже есть |
| F05 | SLA bars (ответ / % в срок / AI≠HS) | 2 | 4 | 3 | 12 | Must | **1C** | queue/mine API |
| F06 | Admin escalate UI | 3 | 3 | 2 | 12 | Should | **1C** | escalate API |
| F07 | Support pane (не placeholder) | 1 | 3 | 3 | 9 | Should | **1B** | chat threads |
| F08 | Settings компании (не placeholder) | 1 | 3 | 2 | 12 | Should | **1B** | Company fields |
| F09 | `GET /v1/tnved/search` + `:code` | Ядро | 5 | 3 | 15 | Must | **2A** | F01 |
| F10 | Импорт батча ТН ВЭД | Ядро | 4 | 3 | 12 | Should | **2A** | F09 |
| F11 | Create UI: `items[].attrs` | 1 | 4 | 2 | 16 | Must | **2B** | F01 |
| F12 | Order detail: показ attrs | 1 | 3 | 1 | 15 | Should | **2B** | F11 |
| F13 | Broker HS autocomplete (ТН ВЭД) | 2 | 5 | 3 | 15 | Must | **2C** | F09 |
| F14 | Soft-validate HS vs справочник | 2 | 3 | 2 | 12 | Should | **2C** | F09, F13 |
| F15 | Подсказки duty/VAT из `TnvedDutyRate` | 2 | 3 | 2 | 12 | Should | **2C** | F09 |
| F16 | `GET …/events` + timeline UI | 1+2 | 4 | 2 | 16 | Must | **2D** | F01 writers |
| F17 | Notify email prod (Resend/SMTP) | Ops | 3 | 2 | 12 | Should | **3** | templates D-EVENT |
| F18 | Preview-БД отдельно от prod | Ops | 2 | 3 | 6 | Could | **3** | ops |
| F19 | Dual-path parity checklist D24 | Ядро | 4 | 2 | 16 | Should | **4** | F01 |
| F20 | `smoke:gateway` стабильный (C5 gate) | Infra | 2 | 2 | 8 | Could | **4** | compose |
| F21 | Presence «Онлайн» / рейтинг footer | 2 | 2 | 2 | 8 | Could | **done** | design-parity |
| F22 | C5 slim cutover | Infra | 2 | 5 | 2 | Won't* | ADR later | D22; не в polish |

\*Won't = не в текущем polish; отдельный ADR.

### Матрица Impact × Effort

Оси: Effort → · Impact ↑. Квадранты задают очерёдность.

```text
Impact ↑
5 │ F01          │ F02 · F09 · F13     │ F10
  │ (quick win)  │                     │
4 │ F12 · F11    │ F04 · F16 · F19     │ F05
  │ F03          │                     │
3 │              │ F06 · F08 · F14     │ F07 · F17
  │              │ F15                 │
2 │              │ F20 · F21           │ F18
  │              │                     │
1 │              │                     │ F22
  └──────────────┴─────────────────────┴──────────→ Effort
       1–2 (S)           3 (M)              4–5 (L)
```

| Квадрант | Правило | Фичи |
|----------|---------|------|
| **Do first** (высокий Impact, низкий Effort) | этап 0 → быстрые Must | F01, F02, F03, F04, F11, F12, F16 |
| **Schedule** (высокий Impact, средний Effort) | этап 1C / 2 | F05, F09, F13, F10 |
| **Fill gaps** (средний Impact) | этап 1B / 2C / 3 | F06–F08, F14–F15, F17, F19 |
| **Later / Won't** | backlog или вне polish | F18, F20–F22; shipping/LLM/ЮKassa — вне матрицы |

### Порядок исполнения по Score (Must → Should)

1. **F01** deploy D24  
2. **F02** chat threads (+ **F03** DevEx)  
3. **F11** attrs create · **F16** events timeline · **F04** thumbs · **F19** dual checklist  
4. **F09** tnved search · **F13** autocomplete · **F12** attrs на карточке  
5. **F05** SLA bars · **F06** escalate · **F08** settings · **F10** import · **F14–F15** validate/hints · **F17** notify  
6. **F07** support · **F18–F20** could · **F21** **done** (footer rating / acceptingJobs)  

Связь с этапами 0–4 — в колонке «Этап плана» таблицы выше; детальные шаги — ниже.

### Вне матрицы (не приоритизируем здесь)

Логистика / shipping UI · LLM enrich · ЮKassa host · Mobile / OCR / Risk — см. [Вне скоупа](#вне-скоупа-явно).

---

## Этап 0 — Выкат D24

**Цель:** writers и схема D24 на prod UI.  
**Оценка:** 1–2 дня.  
**Статус:** ✅ done (2026-08-05) — push + smoke mvp PASS.

| Шаг | Действие | Готово когда |
|-----|----------|--------------|
| 0.1 | `git push origin main` (коммит D24) | `origin/main` содержит D24 |
| 0.2 | Дождаться Vercel deploy | prod UI обновлён |
| 0.3 | `TEST_API_URL=https://ibm-cargo.vercel.app npm run smoke:mvp` и `smoke:full` | PASS; create/pay не 500 на `calculation_events` |
| 0.4 | При drift — `prisma db push` на sweb | schema = Prisma ([`database.md`](./database.md)) |

**Стоп-критерий этапа:** smoke mvp/full зелёные на prod после deploy.

---

## Этап 1 — UI parity (ветви 1–2)

**Цель:** закрыть gaps из [`design-parity.md`](./design-parity.md) (кроме перевозки).  
**Оценка:** 1–1.5 недели.

### 1A. Чат брокера + DevEx

Источники: roadmap §1.6 / §2.1 · ветка `feat/chat-threads-devex`.  
**Статус:** ✅ done на `main` (merge).

| Шаг | Действие | Проверка |
|-----|----------|----------|
| 1.1 | Review / merge `feat/chat-threads-devex` → `main` | CI green |
| 1.2 | Список тредов в `/broker/chat` | parity с рефом `b-chat` |
| 1.3 | DevEx: `npm run setup` / `.nvmrc` | документировано в runbook/development |
| 1.4 | `smoke:chat` на preview/prod | PASS |

### 1B. Support / Settings (клиент)

Источник: roadmap §2.3 · design-parity placeholders.  
**Статус:** ✅ FAQ + SUPPORT ticket + company settings pane.  
**Доп. polish (2026-08-10):** `/settings` → `/profile`; SUPPORT thread read; deep-link `/orders?id=`; unread badges Заявки+Поддержка; compact topup-then-pay — [`cabinets/client/interactions.md`](./cabinets/client/interactions.md).

| Шаг | Действие | Проверка |
|-----|----------|----------|
| 1.5 | `/cabinet/support`: живые SUPPORT-треды или FAQ + ticket stub (не «в росте») | UI usable |
| 1.6 | `/cabinet/profile`: данные компании (name/inn/contacts); `/settings` redirect | save/load API |
| 1.7 | Unit / ручной smoke открытия panes | нет placeholder-only |

### 1C. Broker work / SLA / admin

Источник: roadmap §2.4 · design-parity backlog.  
**Статус:** ✅ bars + escalate gate + unit (thumbs уже были).

| Шаг | Действие | Проверка |
|-----|----------|----------|
| 1.8 | Thumbs `mediaUrl` на карточке работы брокера | видно в `/broker/work` |
| 1.9 | SLA pane: bars средний ответ / % в срок / AI≠HS из live queue/mine | данные live |
| 1.10 | Admin escalate → существующий escalate API | RBAC + unit |
| 1.11 | `smoke:broker` + `smoke:sla` | PASS |

**Стоп-критерий этапа:** gaps чата / support / settings / thumbs / SLA / escalate закрыты в `design-parity.md`.

---

## Этап 2 — D24 в продукте (ТН ВЭД + attrs + история)

**Цель:** scaffold D24 становится UX, не только schema.  
**Оценка:** ~2 недели.  
Канон: [`data-model.md`](./data-model.md) · контракты D-TNVED / D-PRODUCT / D-HISTORY.

### 2A. API справочника

| Шаг | Действие | Проверка |
|-----|----------|----------|
| 2.1 | `GET /v1/tnved/search?q=` + `GET /v1/tnved/:code` | D-TNVED |
| 2.2 | Dual-path: Next session route + `containers/api` | оба пути |
| 2.3 | Unit normalize/search; `PROTECTED_V1_MUTATIONS` при необходимости | `test:ci` |
| 2.4 | Импорт батча номенклатуры (CSV/JSON) → `TnvedCode` + `TnvedDutyRate` | seed/admin script |

**Статус:** ✅ search / `:code` / admin `POST …/import` (Next + api).

### 2B. UI attrs (клиент)

| Шаг | Действие | Проверка |
|-----|----------|----------|
| 2.5 | `/cabinet/new`: поля attrs (бренд, материал, вес, origin, hsHint) | форма |
| 2.6 | Create шлёт `items[].attrs` | API уже принимает |
| 2.7 | Карточка заявки показывает attrs | order detail |

**Статус:** ✅ NewCalcPane attrs + OrderDetail колонка.

### 2C. Справочник в mapping (брокер)

| Шаг | Действие | Проверка |
|-----|----------|----------|
| 2.8 | Autocomplete HS в WorkMapping → `/v1/tnved/search` | UX |
| 2.9 | Soft-validate: warning, если кода нет в справочнике (**не** блок approve) | D15 |
| 2.10 | Подсказки duty/VAT из `TnvedDutyRate` (брокер правит вручную) | D15 |

**Статус:** ✅ `HsCodeAutocomplete` в WorkMapping (search + soft warn + rate hints).

### 2D. История событий

| Шаг | Действие | Проверка |
|-----|----------|----------|
| 2.11 | `GET /v1/calculations/:id/events` | D-HISTORY |
| 2.12 | Timeline в order detail (client) и work (broker) | UI |
| 2.13 | Smoke path create→pay→claim→map→approve → события в БД | count > 0 |

**Статус:** ✅ events API + `EventsTimeline` (client + broker).

**Стоп-критерий этапа:** search ТН ВЭД live; attrs на create; timeline событий; dual writers не разъехались.

---

## Этап 3 — Ops / notify (без эквайринга)

**Цель:** письма по существующим шаблонам D-EVENT.  
**Оценка:** 3–5 дней.

| Шаг | Действие | Проверка |
|-----|----------|----------|
| 3.1 | Prod: `RESEND_API_KEY` или `SMTP_URL` | env |
| 3.2 | Письма: `calc.approved`, `calc.sla_risk`, `ledger.topup` | ручной/smoke |
| 3.3 | Runbook: включение/выключение notify | [`runbook.md`](./runbook.md) |
| 3.4 | Опционально: отдельная preview-БД | меньше мусора в prod DB |

Mock topup **не менять**.

**Стоп-критерий этапа:** хотя бы один template доходит на prod email.

---

## Этап 4 — Dual-path и C5 gate (не блокер polish)

**Оценка:** по мере стабильности этапов 1–2.

| Шаг | Действие | Проверка |
|-----|----------|----------|
| 4.1 | Чеклист parity Next ↔ `containers/api` на D24 writers | code review |
| 4.2 | `docker:full` + `smoke:gateway` стабильно зелёный | C5 scaffold |
| 4.3 | Slim cutover — **только** отдельный ADR (D22 / [`web-slim.md`](./web-slim.md)) | не смешивать с UI/TN VED |

---

## Критерии «MVP polish закрыт»

1. D24 на prod, `smoke:mvp` / `smoke:full` зелёные. *(код done; повторный prod smoke после migrate — ops)*
2. Broker chat: список тредов. **done**
3. Support / settings не placeholder. **done** (+ admin SUPPORT inbox; client settings→profile; SUPPORT thread read)
4. Thumbs + SLA bars + escalate. **done** (+ broker escalate own IN_REVIEW; unread badge; soft refresh; attrs on work)
5. Search ТН ВЭД + attrs в create + timeline событий. **done** (+ broker WorkMapping attrs read-only)
6. `npm run test:ci` зелёный; dual writers согласованы. **done** · [`dual-path-parity.md`](./dual-path-parity.md)
7. UX D27: PDF в карточке + list topup-then-pay. **done** (+ compact recent; deep-link `/orders?id=`)
8. Settings enforcement (marketplace / acceptingJobs / maintenance). **done** · `platform-gates`
9. Notify runbook (F17) + dual-path checklist (F19). **done** (docs); prod email keys — ops

## UX gaps D27 (закрыты в коде)

| Gap | Статус | Где |
|-----|--------|-----|
| PDF в карточке | **done** | `OrderDetail` + list |
| List pay CTA (topup-then-pay) | **done** | `DashboardPane` full **и** compact |
| SUPPORT inbox | **done** | `/admin/support` |
| Settings enforcement | **done** | `platform-gates` + api |
| preferredClaimHours admin | **done** | `/admin/settings` |
| Unread KPI по всем тредам | **done** | badge «Заявки»+«Поддержка»; KPI dashboard |
| Client settings→profile | **done** | redirect + один nav |
| Deep-link `/orders?id=` | **done** | `ClientCabinet` + SupportPane |
| SUPPORT thread read (client) | **done** | SupportPane expand |
| Admin orch UI | **done** | `/admin/orch` |
| OCR scaffold + wire | **done** | `containers/ocr` + fail-open create; local stub verify 2026-08-07 |
| F21 presence / рейтинг footer | **done** | `BrokerCabinet` + `formatBrokerSideFoot` |
| Landing CTAs → auth | **done** (ветка) | `/login` · `/register`; не email-modal |

## Риски (релевантные скоупу)

| Риск | Митигация |
|------|-----------|
| Dual writers D24 | parity Next + api в одном PR |
| Push/deploy отстаёт от schema на sweb | этап 0 обязателен до UI D24 |
| Preview DB = prod | осторожные smoke; опц. отдельная БД (3.4) |
| Раздувание scope (shipping/LLM/ЮKassa) | держать этот документ как границы |

## Связь с roadmap

| Этап здесь | Roadmap |
|------------|---------|
| 0 | §1.7 (push/deploy) |
| 1A | §1.6 / §2.1 |
| 1B | §2.3 |
| 1C | §2.4 |
| 2 | §2.5 |
| 3 | §3.2 (notify only) |
| 4 | Фаза 4 / D22 |

Исключённые из исполнения здесь: roadmap §2.2 (shipping UI), §3.1 (payments host), §3.3 (LLM), §3.4 (CDEK).

Очередь после закрытия кода polish (ops migrate/smoke + Growth): [`roadmap.md`](./roadmap.md) §«Post-polish».
