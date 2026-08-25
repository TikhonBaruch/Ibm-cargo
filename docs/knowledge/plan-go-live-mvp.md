# План: go-live MVP (минимум) — standalone без taurus/llm

**Статус:** **done** (2026-08-25).  
Канон: D27 · D36 · [`plan-full-split-ibm-cargo.md`](./plan-full-split-ibm-cargo.md).

## Цель

Самостоятельный выпуск MVP на prod **без** taurus/llm, **без** live ЮKassa и **без** logistics CTA.

## Выполнено

| # | Шаг | Результат |
|---|-----|-----------|
| 1 | Merge **#6 M2** → `main` | typecheck в `test:ci`, PROTECTED adjust, customs-fees canon |
| 2 | Merge **#7 M0** → `main` | BrokersPane `VedEmptyState` |
| 3 | Merge **#8 D36** → `main` | nested `llm/` удалён, zero coupling |
| 4 | Push `main` | `03fa2b2` |
| 5 | `npm run test:ci` | **PASS** (510) |
| 6 | `npm run typecheck` | **PASS** |
| 7 | Live prod smoke | mvp #47937 · payments · client · full #47938 · broker — **PASS** |

## Prod env (минимум)

`DATABASE_URL`, `NEXTAUTH_*`, `NEXT_PUBLIC_SITE_URL`, `S3_*`, `ALLOW_MOCK_TOPUP=1`, `CRON_SECRET`

## Параллельно

Визуальный редизайн кабинетов — **отдельная ветка** PR #9 (`lbm-bro`), не смешивать с этим релизом. Канон: [`../../docs/plan-lbm-bro-skin.md`](../../docs/plan-lbm-bro-skin.md) · [`plan-max-standalone-mvp.md`](./plan-max-standalone-mvp.md) §Parallel UI.

## Не в scope этого go-live

- Track A live ЮKassa / Resend
- Shipping UI go-live
- LLM-as-CTA
