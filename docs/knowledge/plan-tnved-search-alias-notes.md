# План: search-alias синонимы → `TnvedCode.notes`

**Дата:** 2026-09-04. **D33.**  
**Статус:** **code done** 2026-09-04 · prod `tnved:load -- --search-extras` — нужен `DATABASE_URL` (Vercel Sensitive; CLI pull пустой).  
**Канон:** [`plan-tnved-search-false-friend-audit.md`](./plan-tnved-search-false-friend-audit.md) · [`plan-tnved-demo-corpus.md`](./plan-tnved-demo-corpus.md) · [`plan-tnved-hint-chains-audit.md`](./plan-tnved-hint-chains-audit.md).

## Идея

Search aliases (`TNVED_SEARCH_ALIASES`) и AI/cascade — **разные** слои. В основную БД кладём только **бытовые синонимы** (expand + полные слова) на конкретные 10-значные листья.  
**Не** в notes: `blockHit`, score boost, C21 packs, UI blur.

## Структура

| # | Шаг | Done when |
|---|-----|-----------|
| 1 | `TNVED_SEARCH_ALIAS_DB_LEAVES` + `searchAliasesAsSearchExtras` | unit |
| 2 | Wire в `tnved:load -- --search-extras` | pack merges |
| 3 | `npm run tnved:load -- --search-extras` на prod `newlsu_lbm` | notes updated |
| 4 | Smoke: leaf notes содержат `морс` / `hdd` / `ноутбук` | live |

## Ops

```bash
npm run tnved:load -- --search-extras
```

Повторный прогон идемпотентен (`mergeNotesWithSearchExtras`).
