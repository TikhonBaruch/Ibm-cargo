# Подсказки в полях ввода — карта логики

В демо нет классического autocomplete по мере набора. «Подсказки» = **chips уточнений (clarify)**, зависящие от описания/фото и категории.

**Статус ibm-cargo (2026-08):**

| Фаза | Статус |
|------|--------|
| **P0–P1 (код)** | **live** — shared [`app/src/lib/ved/clarify-hints/`](../app/src/lib/ved/clarify-hints/); NewCalc `ClarifyHintsPanel`; lab wizard re-export |
| **P2** (hs_feedback / nightly weights) | **live** — таблицы + approve write-back + `clarify:reweight` |
| **P3** (typeahead product_profiles) | **live** — в suggest query для partyDescription / itemName |

Канон: `searchValue` (lab UI `value`) → `searchTokens` + `attrsPatch` → HS ranking / ProductAttrs (fill-empty-only).

Источники (исторически lbm-bro): `clarify-ai.ts`, `clarify-options.ts`, `clarify-field.tsx`, `client-wizard.tsx`, `product-copy.ts`.

| Метрика | Значение |
|--------|----------|
| Категорий detect | 15+ |
| Вопросов за раз | ≤3 |
| Слои | Heuristic (+ optional Qwen на lab) |
| Chip value | keywords для HS (`searchValue`) |

**Важно:** `ClarifyOption.searchValue` — не «красивый ответ», а строка ключевых слов для классификатора (например «верх текстиль», «ткань woven»). Она кормит `hs-aliases` / shortlist и (в domain) `attrsPatch`.

---

## 1. Runtime-поток

```
desc / visionHint
        │
        ▼
 detectCategory
        │
        ▼
 detect* gaps (что уже известно в тексте)
        │
        ▼
 questionsForCategory
        │
        ▼
 ≤3 Qs (+ docs в конец, если нужно — только lab)
        │
        ▼
 Qwen API (lab) или heuristic
        │
        ▼
 ClarifyField / ClarifyHintsPanel chips
        │
        ▼
 searchTokens + attrsPatch (+ mergeClarifyAnswers в lab desc)
        │
        ├──────────────────┐
        ▼                  ▼
 HS shortlist / code   ProductAttrs (empty-only)
```

**Триггер в wizard:** debounce ~350 ms на смену `desc` / `docs` / `country`.  
**Multi-pack** (`packMode === "multi"`) → `clarifyEnabled = false`, панель chips скрыта.  
**NewCalc:** inline panel после описания партии; без docs/price Q; без LLM.

---

## 2. Правила построения дерева

1. `detectCategory(desc)` — score по `CATEGORY_KEYS`, с приоритетами (например footwear > sports).
2. `questionsForCategory` — только **gaps**: если состав уже в тексте, chip `composition` не показывают.
3. Короткий desc (`length < 28`) → доп. вопросы (gender, garment, purpose, brand).
4. Truncate в `heuristicClarificationQuestions`:
   - максимум 3 вопроса;
   - если есть `docs` — сначала ≤2 атрибутных, затем docs в конец;
   - docs-вопрос только если нет вложений и `coreReady(desc, category)`.
5. API Qwen может заменить heuristic, но форма та же: `id` / `text` / `options.searchValue`.

### Пример ветки: apparel

```
apparel
  ├─ composition?   (если !detectComposition)
  ├─ knit-woven?    (если нет трикотаж/ткань)
  ├─ color?         (если !detectColor)
  ├─ gender?        (short && не бельё/носки)
  ├─ garment?       (short && тип не детектится)
  └─ brand text     (short && нет бренда)
```

### Пример ветки: footwear

```
footwear
  ├─ upper?     (!detectFootwearUpper)
  ├─ sole?      (!detectFootwearSole)
  ├─ purpose?   (short)
  └─ brand      (short && !detectBrand)
```

### `coreReady` (когда можно спросить про фото/инвойс)

| Категория | Готовность «ядра» |
|-----------|-------------------|
| apparel | есть состав |
| electronics | specs или desc ≥ 36 |
| footwear | upper **и** sole |
| textiles | есть состав |
| прочие | desc ≥ 24 |

---

## 3. Сценарии

| Сценарий | Ввод | Категория | Chips | Поведение |
|----------|------|-----------|-------|-----------|
| Носки хлопок | «носки белые из хлопка» | apparel | knit-woven → цвет (состав уже есть) | Состав детектится → `composition` не показывается |
| Кроссовки коротко | «кросовки» | footwear | upper → sole → purpose (+ brand) | Short desc → все footwear-вопросы; опечатка нормализуется в alias-слое |
| Ноутбук с фото | пустое поле + visionHint «ноутбук Lenovo» | electronics | brand-model / specs | desc из vision; `hasDocs` → не спрашиваем «есть фото?» |
| Товар без описания | «Изделие» / «Новый товар» | generic | kind → material (+ docs) | Слабый title → generic-дерево; answers рулят shortlist |
| Мультипозиция | `packMode=multi` | — | панель скрыта | Clarify выключен; классификация по строкам инвойса |

---

## 4. Структура зависимостей (код)

| Слой | Файл | Роль |
|------|------|------|
| Shared map | `app/src/lib/ved/clarify-hints/` | detect, questions, options+attrsPatch, answers |
| NewCalc UI | `components/ved/client/ClarifyHintsPanel.tsx` | D32 inline chips |
| Lab UI chips | `lbm-bro/components/clarify-field.tsx` | Рендер choice/text, «Другое» |
| Lab wizard | `lbm-bro/components/client-wizard.tsx` | Qs, answers, merge desc + attrs |
| Lab adapters | `lbm-bro/lib/clarify-ai.ts`, `clarify-options.ts` | `value` = `searchValue` |
| Query build | `lbm-bro/lib/product-copy.ts` + `buildEnrichedHsQuery` | HS query |
| HS shortlist | `hs-aliases` + tnved search / `rankHeuristicCandidates` | Ключи из answers → код |

### Цепочка данных chip → HS

```
clarify-hints.searchValue
        → searchTokens / mergeClarifyAnswers
        → buildEnrichedHsQuery / classificationText
        → hs-aliases + tnved search
        → HS code
        → attrsPatch → ProductAttrs (fill-empty)
```

---

## 5. Карта масштабирования с БД

| Фаза | Что сделать | Статус |
|------|-------------|--------|
| **P0** | Shared options module (code) | **live** |
| **P1** | Gaps tree in code (`questionsForCategory`) | **live** |
| **P2** | `clarify_hs_feedback` + nightly `clarify:reweight` + weighted options API | **live** |
| **P3** | Typeahead по `clarify_product_profiles` в `/api/v1/suggest/query` | **live** |

Таблицы (миграция `20260826180000_clarify_hints_learning`):

| Таблица | Роль |
|---------|------|
| `clarify_product_profiles` | канон. описания + HS для typeahead |
| `clarify_attribute_options` | chips + weight / pickCount |
| `clarify_dependency_edges` | category → attr веса |
| `clarify_hs_feedback` | broker approve → обучение |

Операции:

```bash
cd app
npx prisma migrate deploy   # или db push на локали
npm run clarify:seed-options
npm run clarify:reweight    # nightly / cron
```

Write-back: broker `approveCalculation` → `recordClarifyFeedbackFromApprove` (fail-open).  
NewCalc: `POST /api/v1/clarify/questions` (weighted) с fallback на heuristic.  
Suggest: partyDescription / itemName подмешивают profiles (`source: "profile"`).
