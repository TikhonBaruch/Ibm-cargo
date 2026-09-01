# AGENTS.md — LBM Брокер

Единая KB: [`docs/knowledge/README.md`](docs/knowledge/README.md) · ADR [`decisions.md`](docs/knowledge/decisions.md) · каркас [`skeleton.md`](docs/knowledge/skeleton.md).

## Продукт (D27)

Частник: ТН ВЭД (heuristic) → брокер-QC → PDF. Shipping UI default off.  
Демо: `client@example.com` / `broker@example.com` / `admin@example.com` · `demo1234`.  
**Прод этого репо:** https://ibm-cargo-phi.vercel.app (Vercel project `ibm-cargo`).  
**Backup ядра (D37, read-only):** https://taurus-liart.vercel.app — **не трогать** (no deploy/smoke/migrate).  
`https://ibm-cargo.vercel.app` — **чужой** Vercel-проект (статический IBM Cargo). Preview без `DATABASE_URL` ломает вход (Prisma). `/health` → `databaseUrl`. Канон: [`plan-taurus-backup-core.md`](docs/knowledge/plan-taurus-backup-core.md) · [`plan-preview-auth.md`](docs/knowledge/plan-preview-auth.md) §5.

## Куда смотреть

| Тема | Документ |
|------|----------|
| Цикл фичи (D33) | [`feature-cycle.md`](docs/knowledge/feature-cycle.md) |
| Ownership / пакеты (D35) | [`PACKAGES.md`](src/lib/ved/PACKAGES.md) · [`branches.md`](docs/knowledge/branches.md) |
| AI / цепочки / D36 | [`plan-ai-chains-1-2-3.md`](docs/knowledge/plan-ai-chains-1-2-3.md) · [`environments.md`](docs/knowledge/environments.md) · [`plan-zero-llm-coupling.md`](docs/knowledge/plan-zero-llm-coupling.md) |
| Backup taurus (D37) | [`plan-taurus-backup-core.md`](docs/knowledge/plan-taurus-backup-core.md) — **read-only, не трогать** |
| UI (D14/D32) | [`design-patterns.md`](docs/knowledge/design-patterns.md) · [`ved-ui-patterns.mdc`](docs/knowledge/ved-ui-patterns.mdc) · lab [`plan-lbm-bro-visual.md`](docs/knowledge/plan-lbm-bro-visual.md) |
| Notify | [`runbook.md`](docs/knowledge/runbook.md) §Notify · [`dual-path-parity.md`](docs/knowledge/dual-path-parity.md) |
| Rules (локально) | Канон `docs/knowledge/ved-*.mdc`; в checkout: `npm run sync:cursor-rules` → `.cursor/rules/` (gitignored) |
| As-is / деплой / тесты | [`current-app.md`](docs/knowledge/current-app.md) · [`deploy.md`](docs/knowledge/deploy.md) · [`testing-branches.md`](docs/knowledge/testing-branches.md) |

Полный индекс: [`docs/knowledge/README.md`](docs/knowledge/README.md).

## Куда класть код

- Domain → `src/lib/ved/` · Session API → `app/api/v1/` · extract → `containers/api` + `USE_DOMAIN_API=1`
- UI panes → `ved/client` \| `ved/broker` · cabinets только оркестрация
- Нет `@prisma/client` в `containers/{broker,client,admin}`
- HTTP shape контейнера → `docs/contracts/d-*.json`
- **Model ≠ container** (D35): профили/`AI_CHAIN_ID`, не `containers/deepseek`

## Инварианты

Канон: `.cursor/rules/ved-invariants.mdc` (= зеркало `docs/knowledge/ved-invariants.mdc`). Кратко:

1. Очередь брокера только после оплаты (D11).
2. Реальные items — не `id: "synthetic"` (D15); брокер правит HS/duty/VAT/fee, не `TariffPlan.priceRub`.
3. Лимиты D10: EXPRESS 1 / STANDARD 3 / PRO 10.
4. Shipping только после `DONE`; клиентский shipping UI default off (D27).
5. LLM/OCR — opt-in URL / keys; UI не зовёт matrix.
6. Platform gates (D28) · dual-path writers (D24) · BackgroundJob ≠ D8 FSM (D26).
7. D33: без плана в KB — нет кода; без KB — задача не закрыта.
8. Не коммитить `.env` / секреты.
9. **D36 (always):** LBM **отделён** от taurus/llm — nested `./llm` нет в git; свой `DATABASE_URL`; matrix = HTTP only; `containers/{llm,ocr}` LBM-owned.
10. **D37 (always):** **taurus-liart** = backup ядра — **не deploy/smoke/migrate** из ibm-cargo.

## Перед сдачей

1. D33 plan + KB · 2. unit если трогали `src/lib/ved/` · 3. `npm run test:ci` · 4. планы фич — только `docs/knowledge/plan-*.md` (не `.cursor/plans/`).

| Команда | Назначение |
|---------|------------|
| `npm run test:ci` | unit → structure → contracts → verify |
| `npm run smoke:*` | live (running app + seed) |
| `npm run sync:ai-matrix[:check]` | **retired** (D36 no-op stub) |
| `npm run sync:cursor-rules` | `docs/knowledge/ved-*.mdc` → `.cursor/rules/` |
