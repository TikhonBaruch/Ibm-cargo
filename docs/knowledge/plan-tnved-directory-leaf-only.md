# План: directory leaf-only + общее обозначение

**Статус:** **done** 2026-09-04  
**Канон:** [`plan-lbm-bro-tnved-dir.md`](./plan-lbm-bro-tnved-dir.md) · [`plan-client-tnved-search.md`](./plan-client-tnved-search.md)

## 1. Идея

`/cabinet/tnved`: в выдаче только **10-значные** листья (`leafOnly=1`). Если у листа нет нормального `titleRu` — в карточке показывать **общее обозначение** ближайшего предка. Над полем поиска — подсказка, что уточнения запроса помогают найти точный код.

## 2. Структура

| # | Действие | Done when |
|---|----------|-----------|
| 1 | Search URL `leafOnly=1`; группы → листья по префиксу, не `heading=1` | **done** |
| 2 | `directoryReadFromCard`: stub title → ancestor designation | **done** |
| 3 | Hint над инпутом | **done** |

## 3. Критерий

`ноутбук` → только `…0000` 10 цифр; карточка с title/предком; нет 6/8-значных в списке.
