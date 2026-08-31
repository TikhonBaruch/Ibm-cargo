# План: деревья подсказок ТН ВЭД при заполнении заявки (C21)

**Дата:** 2026-08-28. **Цикл D33.**  
Канон: [`plan-tnved-relations.md`](./plan-tnved-relations.md) C20 · [`plan-lbm-bro-newcalc-clarify.md`](./plan-lbm-bro-newcalc-clarify.md) C12 · D15 (`hsHint` ≠ `hsCodeFinal`).

## Идея

На `/cabinet/new` спрашивать развилку товара так, как пишет инвойс: «Молоко: питьевое / сухое / сгущённое». Ответ ведёт на **существующую** позицию классификатора. Официальные дети `parentCode` остаются сплитом «для каждой позиции» на карточке. Не 14 948 рукотворных деревьев.

## Анализ

| Слой | Факт |
|------|------|
| Дерево | 0 сирот; 0401 несгущённое · 0402 сгущённое/сухое · 0403 кисломолочное |
| Пастеризация / UHT | **нет** в title; не выдумывать код |
| Clarify food | чай/кофе/снеки/БАД; «молоко» не в ключах категории |
| NewCalc | C12 чипы; `HsCodeAutocomplete` запрещён hygiene C10–C12 |

## Структура

1. `tnved-hint-tree-packs.json` + `tnved-hint-trees.ts` — семьи D27 → вопрос → `hsHeading`.
2. `getClarificationQuestions` подмешивает pack **перед** категорией; для food/electronics/cosmetics pack заменяет грубый `kind`/`device`.
3. Apply: описание + `attrs.composition` + `attrs.hsHint` (heading, не финал).
4. C19 aliases молока + C20 рёбра 0401↔0402↔0403. `--search-extras`.

## Проверка

«молоко» → чипы питьевое/сухое/сгущённое; сухое → `040210`; пастеризованное не создаёт новый код. `npm run test:ci`. Hygiene C10–C12.

## Не делать

Новые листья. Junction-таблица. `--full` на sweb. Скрейп Альта. Возврат HS-combobox на NewCalc.
