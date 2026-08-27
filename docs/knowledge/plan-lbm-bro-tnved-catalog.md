# План: каталог lab ТН ВЭД → live DB (C18)

**D33.** Lab `/client/tnved` находит большинство кодов, потому что в браузере лежит полный классификатор (`public/lbm-bro/data/tnved.json`, 13 123 узла) + индекс/алиасы. Live `/cabinet/tnved` ходит в Postgres, где сейчас демо-срез (~59 листьев) — бытовые запросы пустые.

**Не** подключать `tnved.json` в браузер live. Каталог lab → `TnvedCode` в **существующей** LBM БД `newlsu_lbm` (sweb). Поиск остаётся `GET /api/v1/tnved/search`. НДС **22%** / ПП **1637**. Не taurus dump (D36/D37).

Канон: [`plan-lbm-bro-tnved-dir.md`](./plan-lbm-bro-tnved-dir.md) · [`plan-tnved-demo-corpus.md`](./plan-tnved-demo-corpus.md) · [`tnved-load.ts`](../../scripts/tnved-load.ts).

## 1. Идея

Тот же справочник, что в lbm-bro, но источником правды live остаётся Postgres + session API.

## 2. Анализ

| Слой | Lab | Live до C18 | C18 |
|------|-----|-------------|-----|
| Узлы | 13 123 (96/957/1797/192/10081) | demo-pack ~59 листьев + предки | upsert lab json в `tnved_codes` |
| Бытовые слова | `hs-aliases` + `tnved-index.aliasTokens` | notes только у демо | notes = алиасы + токены индекса (≤4000) |
| Поиск | title includes + classify | `titleRu/notes contains` + prefix | то же + стем запроса (`футболка`→`футболк`) |
| Группа 84 | 4-значные headings | `q=84` (title «84» шумит) | `heading=1` → `level=4`, prefix |
| Шапка N | `items.length` json | без счётчика | `total` из `count(*)` |
| 8-значные предки | часто нет в json | FK parent обязан существовать | `parentCode` = ближайший существующий узел |

## 3. Фазы

| ID | Что |
|----|-----|
| C18a | Конвертер lab `[code,title]` + notes из алиасов/индекса; nearest parent |
| C18b | `npm run tnved:load -- --lab` чанками, **без** delete rates; загрузка в `newlsu_lbm` |
| C18c | `searchTnvedCodes`: стемы; `headingOnly`; empty q → `{ items:[], total }` |
| C18d | UI: count в шапке; группа → `heading=1`; dual-path `containers/api` |
| C18e | KB + unit + `test:ci` |

## 4. Не делать

- `loadTnved` / `tnved.json` в `TnvedDirectoryPane`
- НДС 20%; freemium; dump taurus
- Удалять demo-pack rates (`seed-demo-pack+fns-tnved4` / tws)
- Сырой ZIP в git (lab json уже в репо)

## 5. Проверка

Lab: «ноутбук», «футболка», «8471» находят позиции. После load — те же запросы на `/cabinet/tnved`. Шапка с живым N. `npm run test:ci`.

## 6. Закрытие

Код: `tnved-lab-catalog.ts`, `tnved:load -- --lab`, search stems/`heading=1`/`total`/`leaves`/`variations`, UI шапка + группы. Dual-path `containers/api`. Браузер live по-прежнему не грузит `tnved.json`.

**Load 2026-08-27:** 13 123 upsert в `newlsu_lbm` (sweb). Active после union с уже лежащим деревом: 31 706 кодов / 14 948 листьев / 15 012 вариаций (notes). 8 alias из индекса указывали на коды вне дерева — токены повешены на ближайший официальный лист (`STALE_INDEX_REMAP`). Проверка: «ноутбук» → `8471300000`, «футболк» → `6109100000`/`6109902000`. Повтор merge: `npm run tnved:load -- --search-extras`.
