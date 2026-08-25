# План кабинетов (D32 / D33)

Обязательный план **до кода** (D33).  
Канон UI: [`design-patterns.md`](./design-patterns.md) **D32**. Фокус продукта: [`product.md`](./product.md) **D27**. Ownership: [`branches.md`](./branches.md). Данные: [`data-model.md`](./data-model.md) · [`databases/`](./databases/) · [`db-process.md`](./db-process.md).

**Порядок волн (не в один PR):** **клиент → брокер → админ → супер-админ**. Производитель (D31) уже live — только стыки, не новая волна.

```text
идея: кабинеты узнаваемы (D32) + связаны с одной Postgres (не ломать контейнеры)
анализ: as-is live; gaps = loading/error + связи SKU/спрос; SUPER ≠ VED admin
структура: 4 волны, отдельные папки UI + dual-path ядро
→ реализация по волне → test:ci → Hobby → KB
```

---

## 1. Идея

Кабинеты уже закрывают MVP D27 (просчёт → QC → PDF) и ops D28. Новые правила требуют:

| Правило | Что меняет в кабинетах |
|---------|------------------------|
| **D32** | Перед экраном назвать паттерн; reuse `VedShell` / `VedToast` / `VedEmptyState` / `VedDetailDrawer`; закрыть **loading / empty / error / success**; не второй визуальный язык; Cmd+K **hold** |
| **D33** | План в KB до `src/`; закрытие только с записью в KB |
| **D31** | SKU завода есть в БД (`manufacturer_skus`, `calculation_items.manufacturerSkuId`), но клиент ещё не выбирает эталон — спрос у завода = 0 |
| **D25/D6/D28** | Нет публичного BROKER/MANUFACTURER signup; SUPER CMS (`/2178737`) не лицо продукта |
| **C1 dual-path** | Любая мутация domain → Next + `containers/api`; UI-контейнеры **без Prisma** |
| **Hobby** | Одна `DATABASE_URL`; migrate отдельно от build; не `WEB_SURFACE=slim` |

**Не в этом плане (Growth / hold):** shipping CTA, live ЮKassa, LLM-кнопка «угадай код», Cmd+K, консолидация партий, buyer-groups, mobile app.

---

## 2. Анализ as-is

| Кабинет | Папка UI | Контейнер | БД / API | D32 gap |
|---------|----------|-----------|----------|---------|
| Клиент | `ved/client/*` | `containers/client` :3003 | Calculation, ledger, chat, company | Boot: empty «нет заявок» пока грузится; нет retry empty; нет выбора SKU завода |
| Брокер | `ved/broker/*` | `containers/broker` :3002 | claim/map/approve, tnved, payouts | Loading очереди слабый; SKU завода на work не виден |
| Админ | `ved/admin/*` | `containers/admin` :3001 | gates, users, orch, SUPPORT | Users уже создаёт MANUFACTURER; нет экрана «каталоги заводов»; soft poll P3 |
| Супер | `src/components/admin/*` + `/2178737` | **не** extract | CMS posts/SEO/infra | Не расширять как продукт (D6); только не ломать и не светить в demo |
| Производитель | `ved/manufacturer/*` | `containers/manufacturer` :3004 | ManufacturerSku | Спрос заработает, когда клиент проставит `manufacturerSkuId` |

Одна Postgres (`database.md`). Контейнеры читают её только через `containers/api` / session Next — **не** второй Prisma в UI.

---

## 3. Структура: папки для параллельных PR

Не смешивать волны в одном diff. Каждая волна трогает **свою** UI-папку + при необходимости **ядро** (`src/lib/ved` + `containers/api`).

```text
Wave C  src/components/ved/client/*     app/cabinet/*      containers/client
        + ядро create/catalog (если SKU)
Wave B  src/components/ved/broker/*     app/broker/*       containers/broker
        + read-only SKU на mapping (ядро GET уже есть)
Wave A  src/components/ved/admin/*      app/admin/*        containers/admin
        + users/manufacturers list (admin users API уже)
Wave S  src/components/admin/*          app/2178737/*      (нет UI-контейнера)
        без Prisma в containers/admin; без CTA на лендинге
Shared  src/components/ved/VedShell.tsx VedToast VedEmptyState VedDetailDrawer
Ядро    src/lib/ved/*  app/api/v1/*  containers/api/src/*
БД      prisma/schema.prisma  prisma/migrations/*
```

Контракты: при новом HTTP — `docs/contracts/d-*.json`. Sensitive POST/PATCH → `PROTECTED_V1_MUTATIONS`.

---

## 4. Волны

### Волна C — Клиент (первая)

**Паттерны D32:** app shell (уже), empty + **одна** CTA, slide-over заявки, toast на pay/topup/support, combobox/select для SKU (не свой dropdown с нуля).

| ID | Работа | БД / связь | Контейнеры | Проверка |
|----|--------|------------|------------|----------|
| **C1** | Boot **loading** ≠ empty; error + retry (`VedEmptyState` / banner + одна CTA «Обновить») | нет новой схемы | `ved/client`, `ClientCabinet` | Ручной `/cabinet` медленная сеть / 401 |
| **C2** | Выбор **опубликованного SKU** завода на позиции просчёта → снимок `attrs` + `manufacturerSkuId` | колонка уже есть; GET каталога для CLIENT | dual-path create items; `GET /v1/catalog/skus` | unit create с skuId; demand у manufacturer > 0 после create |
| **C3** | Heuristic HS top-N + «почему» на `/new` (**не** LLM-кнопка) | read `TnvedCode` / rules | client pane + draft engine | M1.2 · unit draft |
| **C4** | Soft poll заявок ~45с на dash/orders (как брокер) | нет | client only | ручной |

C2 — единственная обязательная **новая связь БД** в клиенте: без неё кабинет завода врёт «спрос = 0». Create остаётся D8/D10/D11; SKU optional; HS по-прежнему AI+брокер (D15).

**Не делать в C:** включать shipping UI; публичный каталог завода на лендинге; ПДн завода клиенту сверх brand/SKU/габаритов.

### Волна B — Брокер

| ID | Работа | БД | Контейнеры | Проверка |
|----|--------|----|------------|----------|
| **B1** | Loading очереди / work (D32), не путать с `acceptingJobs` off | нет | `ved/broker` | queue paused vs loading |
| **B2** | Read-only блок «эталон завода» если `items[].manufacturerSkuId` | FK уже | WorkMapping | attrs + features не редактирует брокер |
| **B3** | Toast/error единообразие на claim/approve (уже частично) | нет | broker | smoke:broker |

Брокер **не** пишет ManufacturerSku и **не** правит `TariffPlan.priceRub`.

### Волна A — Админ (VED `/admin`)

| ID | Работа | БД | Контейнеры | Проверка |
|----|--------|----|------------|----------|
| **A1** | D32: loading/error на bookings/clients/orch | нет | `ved/admin` | empty vs filter vs boot |
| **A2** | Список компаний `kind=MANUFACTURER` (read) + инвайт уже через Users `MANUFACTURER` | `Company.kind` live | admin pane или фильтр clients | не публичный signup |
| **A3** | Soft poll orch/support (P3 из ui-guide) | нет | admin | не ломать toggles D28 |

Админ по-прежнему **не** участник просчёта по умолчанию. SUPER rows скрыты.

### Волна S — Супер-админ (`/2178737`)

| ID | Работа | Правило |
|----|--------|---------|
| **S1** | Не добавлять CMS-фичи как лицо продукта | D6 |
| **S2** | Не показывать SUPER в `/admin/users`, audit, demo-копирайте | D28 |
| **S3** | Если трогаем экран — D32 (toast, labels), без extract в `containers/admin` | D20 |
| **S4** | Infra/`DATABASE_URL` только SUPER | [`database.md`](./database.md) |

Отдельный контейнер SUPER **не** заводить (антипаттерн D19).

---

## 5. Инварианты БД (чтобы не развалить контейнеры)

1. Одна схема Prisma → один Postgres. Compose и Vercel — тот же logical model; UI-контейнеры ходят в web `/api` rewrite.
2. Новые поля — **optional** на hot path create/pay/claim, пока dual-path не зелёный.
3. `manufacturerSkuId` — `onDelete: SetNull`; удаление SKU не ломает старые calc.
4. Снимок `attrs` на item в момент create (карточка завода может измениться позже).
5. Каталог для CLIENT: только `status=PUBLISHED`; без inn/баланса/пользователей завода.
6. Миграции: файл в `prisma/migrations/`; на Hobby `migrate deploy` **отдельно** от Vercel build (`prisma generate` only).
7. Writers: `src/lib/ved/calculations.ts` **и** `containers/api` (create items).

---

## 6. Критерии готовности волны

- Паттерн назван; default/loading/empty/error/success закрыты (D32).
- `npm run test:ci` зелёный.
- Dual-path, если меняли мутацию.
- KB: cabinets README/interactions + эта страница (статус ID).
- Не сломан `smoke:mvp` (клиент) / `smoke:broker` (брокер).

---

## 7. Статус исполнения

| ID | Статус |
|----|--------|
| C1 | **done** |
| C2 | **done** |
| C3 | **done** (этот цикл) |
| C4 | **done** (этот цикл) |
| B1–B3 | **done** (этот цикл) |
| A1–A3 | **done** (этот цикл) |
| S1–S4 | **done** (constraints + D32 на infra/stats/settings; CMS не расширяли) |
