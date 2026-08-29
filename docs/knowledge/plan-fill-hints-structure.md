# План / аудит: структура подсказок при заполнении заявки

**Дата:** 2026-08-29. **D33 (аудит + тесты; без смены chrome NewCalc).**  
Канон: [`plan-newcalc-hints.md`](./plan-newcalc-hints.md) · [`plan-llm-fill-hints.md`](./plan-llm-fill-hints.md) · [`plan-field-suggest.md`](./plan-field-suggest.md) · [`plan-lbm-bro-newcalc-clarify.md`](./plan-lbm-bro-newcalc-clarify.md) · [`plan-tnved-hint-trees.md`](./plan-tnved-hint-trees.md) · [`calculation-fields.md`](./calculation-fields.md).

## 1. Идея

Зафиксировать **какие слои подсказок реально помогают** на live `/cabinet/new` vs Dashboard quick vs orphaned UI, и закрепить расширенным тестом fill-сценариев.

## 2. Анализ (as-is после lbm-bro / pay-first)

```text
Клиент заполняет заявку
├── /cabinet/new (lbm-bro chrome)     ← основной путь
│   ├── textarea описание + select страна
│   ├── C12 ClarifyField  ← getClarificationQuestions (heuristic / opt-in URL)
│   │     └── C21 hint-tree packs (молоко/чай/…) поверх category questions
│   ├── Применить → описание + attrs.composition + attrs.hsHint (heading)
│   └── FieldSuggest / AttrSuggestChips / StageTip / HsHintCandidates  — НЕ смонтированы
├── Dashboard quick-calc
│   ├── StageTip (короткий copy)
│   └── FieldSuggest (local dictionary + POST /api/v1/suggest/query)
└── API (есть, UI NewCalc не зовёт)
    ├── POST /api/v1/calculations/attr-suggest
    └── POST /api/v1/suggest/query  (поле тела: q, не query)
```

| Слой | Domain / UI | Где виден | Status |
|------|-------------|-----------|--------|
| Progressive StageTip | `NewCalcHints` | Dashboard quick; **не** NewCalc | partial |
| Field typeahead | `field-suggest` + `FieldSuggest` | Dashboard; NewCalc только `originCountrySelectOptions` | partial |
| Precedent typeahead | `precedent-suggest` + `POST …/suggest/query` | через FieldSuggest | live API |
| Attr chips | `attr-suggest` + `AttrSuggestChips` | **orphan** (компонент не импортирован) | API live, UI dead |
| HS top-3 candidates | `HsHintCandidates` | **orphan** | dead UI |
| C12 clarify chips | `clarify-ai` + `ClarifyField` | `/cabinet/new` single | **primary** |
| C21 family trees | `tnved-hint-trees` (~12 packs: milk, knit-top, footwear, computers, cosmetics, toys, …) | через clarify на NewCalc | **primary** fill help |
| Pay-first HS reveal | post-pay alts | шаг 3 после `paidAt` | separate |

## 3. Расширенное тестирование (2026-08-29)

### Unit / structure

`src/components/ved/client/__tests__/fill-hints-structure.test.ts` + существующие suites:

```bash
npx vitest run \
  src/components/ved/client/__tests__/fill-hints-structure.test.ts \
  src/components/ved/client/__tests__/new-calc-clarify.test.ts \
  src/components/ved/client/__tests__/new-calc-hints.test.ts \
  src/lib/ved/__tests__/field-suggest.test.ts \
  src/lib/ved/__tests__/attr-suggest.test.ts \
  src/lib/ved/__tests__/tnved-hint-trees.test.ts \
  src/lib/ved/__tests__/suggest-query-guard.test.ts
```

Покрытие fill-кейсов: носки, майка, джинсы, кроссовки, ноутбук, смартфон, молоко/сухое/йогурт, чай/кофе, крем, игрушка; apply milk→040210; socks composition; attr gaps footwear/dairy.

### Live prod (`ibm-cargo-phi`, client session)

| Probe | Результат |
|-------|-----------|
| `POST attr-suggest` майка/носки/ноутбук | **OK** chips + hsHint |
| `POST attr-suggest` молоко/кроссовки | только generic purpose (нет RULE) — C12/C21 закрывают |
| `POST suggest/query` `{ kind, q:"нос" }` | **носки** local |
| `POST suggest/query` с полем `query` вместо `q` | пустой q → top-N алфавит (ловушка контракта) |
| NewCalc UI AttrSuggestChips | не смонтирован на ветке lbm-bro |

## 4. Gaps / рекомендации (не в этом PR, кроме тестов+KB)

| ID | Gap | Рекомендация |
|----|-----|--------------|
| H1 | AttrSuggestChips orphan после C10 chrome | Вернуть chips под clarify **или** удалить dead UI + оставить API |
| H2 | FieldSuggest нет на NewCalc textarea | Опционально: typeahead на описание (D32 combobox), не ломая C10 |
| H3 | attr-suggest без footwear/dairy | Добавить RULE **или** явно «clarify-only» в KB |
| H4 | StageTip не на NewCalc | Либо wire, либо deprecate `newCalcStageTip` для NewCalc |
| H5 | Контракт `q` vs `query` | Уже в schema; упомянуть в contract/`d-suggest.json` examples |

## 5. Не делать сейчас

Wizard API · LLM CTA на clarify · автозалив attrs без клика (D15) · HS-combobox на NewCalc (C10 hygiene).

## 6. Статус

| Срез | Status |
|------|--------|
| Карта слоёв + gaps | **done** (этот файл) |
| Extended vitest fill suite | **done** |
| Live API probe | **done** (prod) |
| Wire orphan UI back to NewCalc | **hold** — отдельный цикл после продукта |
