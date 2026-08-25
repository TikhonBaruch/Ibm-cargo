# Общий цикл любой фичи (LBM Брокер)

Канон процесса разработки для агентов и людей.  
Адаптировано из портфельного «цикл любой фичи» под **этот** репозиторий (не CMS егеря / не click-bridge).  
Индекс: [`README.md`](./README.md) · ownership: [`branches.md`](./branches.md) · каркас: [`skeleton.md`](./skeleton.md) · тесты: [`testing-branches.md`](./testing-branches.md).

**Продуктовый фокус:** D27 — ТН ВЭД (heuristic) → брокер-QC → PDF. Growth (ЮKassa / LLM-CTA / shipping / полный dump ТН ВЭД) не смешивать в MVP-фичу без явного ADR.

**D33 (обязательно):** любая идея и сборка — только по циклу ниже. **Без плана код не писать. Без записи в единую базу задачу не закрывать.** Правило: [`ved-feature-cycle.mdc`](./ved-feature-cycle.mdc).

```text
идея → анализ → структурирование (обязательный план)
  → реализация → проверка → анализ → правка при багах
  → деплой (Vercel Hobby, бесплатный тариф) → запись в docs/knowledge/
```

Инженерная детализация тех же шагов:

```text
1. Канон → 2. Зона → 3. Контракт → 4. Код
5. Тесты → 6. Smoke/ручная → 7. Docs → 8. Merge/деплой
```

Стоп при первом красном шаге.

**План до кода:** новый или обновлённый `docs/knowledge/plan-*.md` (или секция в существующем плане) с идеей, анализом, структурой фаз. Не начинать diff в `src/` / `app/` / `containers/` без этого. Опечатка / однострочный copy — три буллета в PR, всё равно с именами шагов цикла.

**Закрытие:** PR без правки KB (`docs/knowledge/`, при необходимости contracts/cabinets) **не** считается сданным, даже если CI зелёный.

---

## A. Восемь шагов

| # | Действие | Критерий «можно дальше» |
|---|----------|-------------------------|
| **1** | Канон: [`product.md`](./product.md) (D27), [`decisions.md`](./decisions.md), [`skeleton.md`](./skeleton.md) checklist; при данных — [`data-model.md`](./data-model.md) / [`calculation-fields.md`](./calculation-fields.md); **D36** — нулевая связка с taurus/nested `./llm` | Понятно: зачем фича, кого не ломаем, hold Growth, изоляция матрицы |
| **2** | Зона ownership: ветвь **1 Client** / **2 Broker** / **3 Ядро** (+ Admin D28). Путь кода = [`branches.md`](./branches.md) | Нет конфликта зон; UI не тащит Prisma в `containers/{client,broker,admin}` |
| **3** | Контракт: роли allow/deny, HTTP метод/path, «done when»; при envelope — `docs/contracts/d-*.json` | Session → 401; wrong role → 403; shape согласован dual-path |
| **4** | Код в своей зоне; domain в `src/lib/ved/`; UI panes в `ved/client` \| `ved/broker`; session API `app/api/v1` | `npm run dev` жив; инварианты D8/D10/D11/D15 не нарушены |
| **4u** | **UI (D32):** назвать паттерн; reuse `VedShell` / `VedToast` / `VedEmptyState` / `VedDetailDrawer`; [`design-patterns.md`](./design-patterns.md) | Нет второго визуального языка; empty/error/loading закрыты |
| **4b** | **Dual-path** (если мутация domain): зеркало в `containers/api` + [`dual-path-parity.md`](./dual-path-parity.md) | Next (`USE_DOMAIN_API=0`) и api (`=1`) ведут себя одинаково |
| **4c** | Чувствительная мутация → строка в `PROTECTED_V1_MUTATIONS` (`access.ts`) | Middleware режет без сессии |
| **5** | Unit на инвариант / gate / domain (`src/lib/ved/__tests__/`) | `npm run test:unit` зелёный на затронутом |
| **6** | Smoke и/или ручной сценарий роли; при schema — migrate на целевой БД | Happy-path + deny; нет 500 на затронутых URL |
| **7** | Docs в том же PR: KB / contracts / cabinets correctness при смене поведения | KB ↔ код ↔ smoke совпадают |
| **8** | `npm run test:ci` → merge → Vercel Hobby; migrate на prod DB **отдельно** (build = `prisma generate` only); не `WEB_SURFACE=slim`; не второй `DATABASE_URL` | `smoke:mvp` или узкий smoke; `ops:track-a` если трогали env/holds |

Шаги **4b/4c** — обязательные дополнения к исходному алгоритму (dual writers + middleware). Не пропускать «потому что localhost».

---

## B. Слои тестирования

| Слой | Инструмент | Когда |
|------|------------|--------|
| Unit | `npm run test:unit` / `test:ci` | Domain, gates, invariants |
| Structure / contracts | `test:structure`, `test:contracts` | Ownership, envelopes |
| Live spine | `TEST_API_URL=… npm run smoke:mvp` \| `smoke:full` | Create → pay → approve → PDF |
| Role / ветвь | `smoke:broker`, `smoke:chat`, `smoke:shipping`, … | См. [`testing-branches.md`](./testing-branches.md) |
| Ops gates | `npm run ops:track-a` (+ `-- --vercel`) | Resend / payments / D27 holds |
| Ручной UI | Чеклист C↔B↔A в [`staging.md`](./staging.md) | После UI-фич кабинетов |
| Compose Growth | `smoke:chain-llm`, `precedent-*`, `csv-import`, `reclassify` | Только при compose + ключах; не блокер MVP |

**Не путать:** в чужом шаблоне было `npm run test:run` и `admin-role-smoke.mjs` — здесь канон **`test:ci`** и **smoke:\*** из `package.json`.

### Быстрый контур

```bash
npm run dev                    # Mode A, см. environments.md
npm run test:ci
TEST_API_URL=https://ibm-cargo.vercel.app npm run smoke:mvp
npm run ops:track-a
```

Preview: SSO Vercel часто включён — открывать через PR «Visit Preview». Prod custom domain без SSO.

---

## C. Пошаговая проверка «MVP жив» (D27)

Идти по порядку; стоп при первом красном.

| ID | Проверка | Ожидание |
|----|----------|----------|
| **C0** | Env: `DATABASE_URL`, `NEXTAUTH_*`, `ALLOW_MOCK_TOPUP`, `S3_*` | Prod login 200; upload не 503 |
| **C1** | `npm run test:ci` | unit + structure + contracts + verify |
| **C2** | `smoke:mvp` или `smoke:full` | register/create → pay → DONE + PDF (heuristic OK без LLM) |
| **C3** | Ручной: client → broker → admin | Чеклист [`staging.md`](./staging.md) §«Визуальный чеклист» |
| **C4** | Поверхность | `/`, `/login`, `/register`, `/cabinet`, `/broker`, `/admin` без 500 |
| **C5** | Holds D27 | shipping UI off; нет LLM-CTA; нет slim на Vercel |

Фаза «кабинеты + заявка» считается закрытой для MVP, когда **C1–C2** зелёные и **C3** пройден хотя бы один раз после крупного UI merge.

---

## D. Ближайший план разработки (с учётом as-is 2026-08-12)

Статус: скелет MVP **на prod**; PR cabinet pack **merged**; live ЮKassa / полный ТН ВЭД / LLM-диалог — **вне** текущего скоупа.

### Этап M0 — Эксплуатация MVP (сейчас)

| # | Работа | Проверка |
|---|--------|----------|
| M0.1 | Mock topup + S3 остаются включены | `smoke:payments`, upload URL s3 |
| M0.2 | Визуальный C↔B↔A на prod | Чеклист staging |
| M0.3 | Empty states + копирайт D27 (не рерайт лендинга) | Паттерн: заголовок + почему + **одна** CTA · канон [`cabinets/ux-saas.md`](./cabinets/ux-saas.md) §8 · эталон: дашборд клиента / BrokersPane / QueuePane |

Порядок кабинетов (не в один PR): **клиент → брокер → админ → супер-админ**. Производитель v1 (**D31 live**) — стыки SKU, не отдельная волна. Канон волн: [`plan-cabinets-d32.md`](./plan-cabinets-d32.md). Command palette — hold.

### Этап M1 — Доводка UX кабинетов (без Growth CTA)

| # | Работа | Проверка |
|---|--------|----------|
| M1.0 | Клиент empty states (баланс, фильтры заявок) | Ручной `/cabinet` без данных · **live** |
| M1.b | Брокер empty + `acceptingJobs` режет queue API | Queue пуста честно; [`cabinets/broker/interactions.md`](./cabinets/broker/interactions.md) · **live** |
| M1.c | Админ: секции сайдбара Операции / Каталог / Платформа | [`cabinets/ux-saas.md`](./cabinets/ux-saas.md) §5 · **группы live**; panes — M2 |
| M1.1 | Контент лендинга / подсказки статусов под D27 | Ручной `/` + кабинеты — **только по явному запросу** на копирайт лендинга |
| M1.2 | UX кандидатов HS поверх **heuristic** (top-N + краткое «почему» из правил) — **не** LLM-CTA | Unit draft + ручной create · **done** C3 |
| M1.3 | Починить `smoke:client` под autoAssign → `IN_REVIEW` | Скрипт PASS на prod |

### Этап M2 — Tech-debt (параллельно, не блокер CTA)

См. [`plan-tech-debt.md`](./plan-tech-debt.md): lint Next 16, tsc gate, PROTECTED adjust/imports, dual-path docs, AdminVedCabinet panes **после** групп nav (M1.c).

### Этап M3 — Ops опционально

| # | Работа | Проверка |
|---|--------|----------|
| M3.1 | `RESEND_API_KEY` (письма после approve) | Outbox DELIVERED; `ops:track-a` |
| M3.2 | Precedent-v1 накапливается на prod approve | Второй похожий create без LLM |

### Этап G — Growth (не начинать поверх красного M0)

ЮKassa · LLM clarify-диалог · полный dump ТН ВЭД · shipping UI · OCR vision · C5 slim — только с ADR / ключами.

**Кабинет производителя v1** (SKU catalog + спрос, инвайт ADMIN, не публичный signup) — **D31 live** `/manufacturer`. Сборный заказ + сегменты клиента — **D34** [`plan-consolidate-orders.md`](./plan-consolidate-orders.md). Не обещать в CTA D27. Buyer-groups — позже Ecosystem.

См. [`growth.md`](./growth.md), [`plan-track-a-p0.md`](./plan-track-a-p0.md), [`plan-ocr-vision.md`](./plan-ocr-vision.md).

**Правило:** пока M0.1–M0.3 красные, не смешивать этап G в один PR с MVP-доводкой.

---

## E. Мини-схема «один день»

```text
План в docs/knowledge (D33) → канон D27 / ADR → зона 1|2|3 → контракт (+PROTECTED)
  → код (+dual-path, UI=D32) → unit → test:ci
  → smoke:mvp|ветвь → KB patch → merge Hobby → prod smoke
```

Роли/API изменились? → `access.ts` + dual-path + docs в **том же** PR.

---

## F. Одной фразой (процесс)

**D33:** идея → анализ → **план** → реализация → проверка → анализ → правка → деплой Hobby → KB. Без плана код не писать; без KB не закрывать. Дальше — ветви client/broker/ядро и инварианты D8–D15/D27: unit + `test:ci`, dual-path при domain-мутациях, live `smoke:mvp`/`full` и ручной C↔B↔A; релиз — merge на Vercel Hobby + точечный prod smoke без Growth CTA.

---

## Связь с другими документами

| Документ | Роль |
|----------|------|
| [`skeleton.md`](./skeleton.md) | Checklist перед фичей (детали) |
| [`roadmap.md`](./roadmap.md) | Фазы и post-polish + ссылка на этапы M0–G |
| [`plan-tech-debt.md`](./plan-tech-debt.md) | M2 hardening |
| [`plan-cabinets-d32.md`](./plan-cabinets-d32.md) | Волны кабинетов C→B→A→S (D32/D33) |
| [`plan-global.md`](./plan-global.md) | Горизонт этапов 1–5 (поиск ТН ВЭД → mesh → фото/ссылка) |
| [`staging.md`](./staging.md) | Preview/prod smoke + визуальный чеклист |
| [`testing-branches.md`](./testing-branches.md) | Матрица smoke |
| [`dual-path-parity.md`](./dual-path-parity.md) | Шаг 4b |

Чужой шаблон (егерь / landing bridge / TG cron / `admin-role-smoke`) **не** копировать в задачи LBM Брокер.
