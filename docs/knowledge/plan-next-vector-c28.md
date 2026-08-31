# План: следующий вектор после C18–C27 (C28+)

**Дата:** 2026-08-28. **D33.**  
Канон: [`plan-global.md`](./plan-global.md) · [`plan-classify-cascade-c23.md`](./plan-classify-cascade-c23.md) · [`plan-tnved-opendata-card.md`](./plan-tnved-opendata-card.md) · [`product.md`](./product.md) D27.

## 1. Идея

Закрыть **разрыв lab ↔ live** и **дыры справочника**, не уходя в Growth (ЮKassa / mesh / shipping).  
Вектор последних циклов — каталог → поиск → cascade → pay-first. Следующий — **качество кода после оплаты**, **легальные слои карточки**, **стабильный Preview smoke**.

## 2. Анализ: где мы сейчас

### Сделано (ветка / PR #19 → merge)

| ID | Что | Эффект |
|----|-----|--------|
| C18 | lab ∪ ФНС → Postgres (~31k / ~15k leaves) | live `/cabinet/tnved` ≈ lab поиск |
| C19–C21 | invoice aliases, relations, hint-trees | инвойс CN/RU + clarify packs |
| C22 | AiRunCard + disclaimer | UX результата как lab step 4 |
| C23–C27 | cascade-v1 + OCR glue + audit | draft до heuristic/LLM |
| Pay-first | Товар → Оплата → Код; hide HS до `paidAt` | как lab, без «бесплатного» кода |
| Smoke unblock | mvp fallback seed; CSV attrs | prod smoke без mock topup |

### Gaps (прогон + сверка lab)

| Gap | Серьёзность | Почему |
|-----|-------------|--------|
| Preview SSO блокирует curl/agents | ops | Deployment Protection; Visit Preview only |
| Prod ещё без pay-first / cascade | **merge #16** | ibm-cargo-phi = старый UI до merge; исполнение: [`plan-merge-ops-unblock.md`](./plan-merge-ops-unblock.md) |
| Слой B ЕТТ на sweb = `null` | product | карточка без пошлины; local TWS ≠ НСИ |
| Слой D/E (PSN / решения ЕЭК) слабо на карточке | product | notes soup, нет join решений |
| Cascade hints убраны с NewCalc (pay-first) | UX | после оплаты нет top-N «почему» на шаге 3 |
| Vision OCR / ключи | Growth | C25 glue есть; E2E hold |
| Voice / freemium narrative | lab-only | не D27 MVP |
| БД-2 мало реальных approve | quality | cascade часто → heuristic |
| `classify-preview` 404 на prod | deploy | маршрут только в ветке |

### Не трогать в этом векторе

Browser Tesseract · `tnved.json` в client · scrape Альта/TKS · `tnved:load -- --full` на sweb · shipping UI · LLM-as-CTA · финал без брокера (D15).

## 3. Структура фаз

```text
C28  ship + verify pay-first / cascade на Preview+prod
C29  post-pay code UX (шаг «Код» = lab step 4 полностью)
C30  справочник: слой B/D на карточке (легально)
C31  качество cascade + БД-2 seed из approve
C32  Preview DevEx (SSO bypass для smoke / docs)
—— hold ——
C33  vision OCR E2E (ключ + compose)
C34  Track A payments (ЮKassa) — вне D27 polish
C35  offline-first HS + DeepSeek on miss (brief → plan → code)
```

### C28 — Ship & verify (ближайший)

| Шаг | Действие | Done when | Status |
|-----|----------|-----------|--------|
| C28a | Merge PR **#16** → `main` (внутри уже #19 C19–C31) | pay-first на ibm-cargo-phi | **done** 2026-08-31 (`b7418aa`) |
| C28b | Ручной / smoke: create→pay→approve | HS path after pay | **done** — `smoke:mvp` PASS on prod 2026-08-31 |
| C28c | `TEST_API_URL=<prod\|preview> npm run smoke:mvp` | PASS | **done on prod**; Preview after O1–O3 |
| C28d | `npm run test:classify-cascade` | PASS | **done** 94 tests 2026-08-31 |
| C28e | KB: `current-app` — C18–C31 **на main** | запись | **done** (this closeout) |

**Ownership:** Client + Core. Без новых domain writers.

### C29 — Post-pay code experience

После оплаты клиент должен видеть тот же нарратив, что lab step 4.

| Шаг | Что | Status |
|-----|-----|--------|
| C29a | Шаг 3 NewCalc: AiRunCard → HS + conf + «Почему» (уже частично) | **done** |
| C29b | `classify-preview` **после** pay (не до) — top-3 альтернативы на шаге 3 | **done** |
| C29c | Copy: убрать «1 бесплатно» / 0 ₽ — всегда `TariffPlan.priceRub` | **done** |
| C29d | Unit hygiene: free-banner vs live price | **done** |

**Не:** `consumeFreeHs` в domain без ADR; НДС 20%.

### C30 — Карточка справочника (слои B/D)

Цель: карточка `/cabinet/tnved` ближе к «Таксе», без scrape.

| Шаг | Слой | Источник | Status |
|-----|------|----------|--------|
| C30a | B fill: честный UI `нет в НСИ` / `fill (не НСИ)` для tws-csv | `formatCardDutyLabel` | **done** |
| C30b | Повторный probe НСИ СТНВЭДСТ / KZ v4 | [`plan-tnved-collect.md`](./plan-tnved-collect.md) | **ops hold** |
| C30c | PSN → `explanation` на карточке (notes + must-cover overlay) | json → `GET :code` | **done** |
| C30d | ЕЭК решения: join по 10-digit, fail-open empty index | overlay | **done** (index empty until ETL) |

Load: только `tnved:load -- --search-extras` / точечный upsert; **не** wipe rates на sweb.

### C31 — Качество определения

| Шаг | Что | Status |
|-----|-----|--------|
| C31a | Расширить `classify-cascade.fixture.json` (~37 must-cover RU/EN/CN) | **done** |
| C31b | Admin/ops: после N approve проверить рост БД-2; smoke precedent | ops |
| C31c | Alias pack: CN/RU short tokens (jeans, filters, brake pads, smartwatch≠91) | **done** |
| C31d | Dual-path: cascade в `containers/api` create = Next | **done** |

Fixture: electronics, apparel, auto parts, dairy, cosmetics. Aliases: `tnved-invoice-aliases.json` + lab `910211` exclude smartwatch.

### C32 — Preview / smoke DevEx

Канон: [`plan-c32-preview-devex.md`](./plan-c32-preview-devex.md).

| Шаг | Что | Status |
|-----|-----|--------|
| C32a | Docs: Visit Preview + `ALLOW_MOCK_TOPUP` checklist | **done** |
| C32b | Protection Bypass for Automation + `install-vercel-bypass` в smoke | **docs/helper done**; secret = human ops |
| C32c | `smoke:standalone` зелёный на Preview после C28 | **blocked SSO** (2026-08-29) до bypass secret |

### Hold (после C28–C32)

| ID | Тема | Триггер |
|----|------|---------|
| C33 | Vision OCR E2E | OCR key + UI upload path |
| C34 | ЮKassa live | Track A keys; выкл mock |
| **C35** | **Offline-first HS + DeepSeek только на miss** (цепочки ∥ структура БД-2) | Бриф готов → детальный план до кода: [`plan-offline-first-hs-brief.md`](./plan-offline-first-hs-brief.md) |
| — | Voice / proto-bar | не MVP |
| — | Shipping / factory CTA | D27 hold |

### C35 — Offline-first classify (brief, не код)

**Идея:** не звать DeepSeek/LLM на каждый запрос; часть определений — precedent + cascade + corpus в БД; параллельно вести поток A (gate/метрики цепочек) и поток B (наполнение БД-2 / aliases).

| Шаг | Что | Status |
|-----|-----|--------|
| C35-brief | Точная постановка задачи, метрики-кандидаты, вопросы §8 | **done** — [`plan-offline-first-hs-brief.md`](./plan-offline-first-hs-brief.md) |
| C35-plan | Ответы на вопросы брифа → `plan-c35-offline-first-hs.md` (фазы A∥B) | **next dialogue** |
| C35-impl | Код только после C35-plan | blocked |

**Не смешивать** с C33 vision E2E и C34 ЮKassa.

## 4. Приоритет (Impact × Effort)

| ID | Impact | Effort | MoSCoW |
|----|--------|--------|--------|
| C28 | высокий | низкий | **Must** |
| C29c freemium honesty | высокий | низкий | **Must** |
| C29a–b post-pay UX | средний | средний | Should |
| C30a honest duty null | средний | низкий | Should |
| C30b–d B/D/E layers | высокий | высокий | Could |
| C31 fixtures + aliases | высокий | средний | Should |
| C32 SSO bypass | средний | ops | Could |
| C33–C34 | высокий | высокий | Won't (сейчас) |
| C35 offline-first HS | высокий | средний→высокий | **Should** (после C28 ship; сначала plan) |

## 5. Проверка

```bash
npm run test:ci
npm run test:classify-cascade
TEST_API_URL=<preview> npm run smoke:mvp
TEST_API_URL=<preview> npm run smoke:csv-import
# ручной: pay-first + /cabinet/tnved «ноутбук» / «充电宝»
```

## 6. Связь с горизонтом

| plan-global этап | Этот вектор |
|------------------|-------------|
| 1 поиск ТН ВЭД | C28–C31 усиливают |
| 2 базы + ИИ | C31 БД-2; **C35 offline-first** ([brief](./plan-offline-first-hs-brief.md)); C33 vision later |
| 3 mesh | **не** в C28–C32; C35 не = multi-LLM router |
| 4–5 фото/флаги | hold |

## 7. Закрытие цикла

После каждой фазы C28–C32: `test:ci` → Preview smoke → запись статуса в этот файл + [`current-app.md`](./current-app.md).  
Merge без KB — не сдача (D33).
