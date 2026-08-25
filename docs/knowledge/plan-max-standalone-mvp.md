# План: max standalone MVP (без оплаты live и логистики)

**Статус:** **done** (2026-08-25).  
После: [`plan-go-live-mvp.md`](./plan-go-live-mvp.md) (merge #6→#7→#8 **done**).

## Идея

Довести ibm-cargo до **максимума доступной реализации** для частника D27 **без**:

- live эквайринга (ЮKassa) — mock topup достаточен;
- logistics / shipping UI CTA;
- nested taurus/llm.

**Параллельно:** новый визуальный вид кабинетов (lbm-bro, PR #9) — **не блокирует** этот трек; не трогаем shell/токены/landing skin в backend-PR.

## Что уже на max для MVP (prod smoke 2026-08-25)

| Область | Статус | Проверка |
|---------|--------|----------|
| Signup / auth D25 | live | smoke:mvp register |
| Heuristic draft + attrs D24 | live | smoke:full |
| Mock topup + pay D13 | live | smoke:payments, mvp |
| Broker QC + PDF D11/D8 | live | smoke:broker, mvp |
| S3 uploads | live | mvp/full upload URL |
| autoAssign IN_REVIEW | live | smoke:client, mvp |
| Admin ops D28 | live | M0.2 visual |
| Full split D36 | **main** | no `llm/` in git |
| typecheck gate M2 | **main** | `npm run typecheck` PASS |
| precedent-v1 enrich | live | smoke:full log |

## Шаг 2 (этот PR) — без UI skin

| # | Задача | Зона | Статус |
|---|--------|------|--------|
| 1 | KB drift: core-dialogues, plan-ai-mesh, plan-ocr-vision | docs | **done** |
| 2 | `branches.md` — parallel visual track (lbm-bro) | docs | **done** |
| 3 | Prod smoke matrix post-merge в staging | docs | **done** |
| 4 | Индекс README → go-live + max plan | docs | **done** |

## Done when

- [x] go-live merge on `main`
- [x] prod smoke spine PASS (#47937–#47938)
- [x] KB без ссылок на удалённый `llm/` tree
- [x] parallel UI track задокументирован в branches

**Статус:** **done** (2026-08-25).
