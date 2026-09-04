# План: search alias boost (морс≠морская, HDD→8471)

**Статус:** **done** 2026-09-04 · live H5 `морс`→2202 · `HDD`→8471 on `ibm-cargo-phi`  
**Канон:** [`staging.md`](./staging.md) §C21b H5 · [`plan-c21-multistep-all-families.md`](./plan-c21-multistep-all-families.md) G5 residual · [`plan-tnved-hint-chains-audit.md`](./plan-tnved-hint-chains-audit.md) (false friends).

## 1. Идея

C21 packs уже ведут `морс→snacks/2202` и `HDD→pc-parts/8471`. Live H5 (`GET /api/v1/tnved/search`) падает отдельно:

| Query | As-is top | Причина |
|-------|-----------|---------|
| `морс` | `2501` «морская» | substring `морс` ⊂ `морск*` |
| `HDD` | empty | аббревиатура нет в titleRu/notes |

## 2. Анализ

- Слой: `searchTnvedCodes` + `scoreTnvedSearchHit` (`src/lib/ved/tnved.ts`) · dual-path `containers/api/src/tnved-helpers.js`.
- Не трогать C21 packs.
- Нужны: (a) **codePrefix OR** в pool, (b) **score boost** на prefix, (c) для морс — **blockHit** `морск*` (denylist lexical).

## 3. Структура

| # | Шаг | Done when |
|---|-----|-----------|
| 1 | `TNVED_SEARCH_ALIASES` + `resolveTnvedSearchAlias` | **done** unit |
| 2 | Wire expand stems + code OR + score boost/block | **done** dual-path |
| 3 | Tests score order морс/HDD | **done** |
| 4 | Staging H5 note + probe | **done** live PASS |

## 4. Критерий

`q=морс` → top `2202*` · `q=HDD` → top `8471*`.
