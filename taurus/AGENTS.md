# AGENTS.md — ibm-cargo / LBM Брокер

Репозиторий: **ibm-cargo** (`TikhonBaruch/Ibm-cargo`) — самостоятельный продукт, не зеркало upstream taurus.  
Каталог `taurus/` здесь — пакет приложения (историческое имя папки), не отдельный remote.

Единая KB: [`docs/knowledge/README.md`](docs/knowledge/README.md) · ADR [`decisions.md`](docs/knowledge/decisions.md) · каркас [`skeleton.md`](docs/knowledge/skeleton.md).

## Продукт (D27)

Частник: ТН ВЭД (heuristic) → брокер-QC → PDF. Shipping UI default off.  
Демо: `client@` / `broker@` / `operator@` / `admin@example.com` · `demo1234`.  
Прод (исторический host, пока не сменён): https://taurus-liart.vercel.app

## Куда смотреть

| Тема | Документ |
|------|----------|
| Цикл фичи (D33) | [`feature-cycle.md`](docs/knowledge/feature-cycle.md) |
| Ownership / пакеты (D35) | [`PACKAGES.md`](src/lib/ved/PACKAGES.md) · [`branches.md`](docs/knowledge/branches.md) |
| AI / цепочки / llm↔compose | [`plan-ai-chains-1-2-3.md`](docs/knowledge/plan-ai-chains-1-2-3.md) · [`environments.md`](docs/knowledge/environments.md) · `npm run sync:ai-matrix` |
| UI (D14/D32) | Skill `.cursor/skills/ved-ui` · [`design-patterns.md`](docs/knowledge/design-patterns.md) |
| Notify | Skill `.cursor/skills/ved-notify` |
| As-is / деплой / тесты | [`current-app.md`](docs/knowledge/current-app.md) · [`deploy.md`](docs/knowledge/deploy.md) · [`testing-branches.md`](docs/knowledge/testing-branches.md) |

Полный индекс: [`docs/knowledge/README.md`](docs/knowledge/README.md).

## Куда класть код

- Domain → `src/lib/ved/` · Session API → `app/api/v1/` · extract → `containers/api` + `USE_DOMAIN_API=1`
- UI panes → `ved/client` \| `ved/broker` · cabinets только оркестрация
- Нет `@prisma/client` в `containers/{broker,client,admin}`
- HTTP shape контейнера → `docs/contracts/d-*.json`
- **Model ≠ container** (D35): профили/`AI_CHAIN_ID`, не `containers/deepseek`
- LLM-матрица — соседний пакет [`../llm`](../llm) в том же репозитории ibm-cargo

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

## Перед сдачей

1. D33 plan + KB · 2. unit если трогали `src/lib/ved/` · 3. `npm run test:ci` · 4. не править `.cursor/plans/` без запроса.

| Команда | Назначение |
|---------|------------|
| `npm run test:ci` | unit → structure → contracts → verify |
| `npm run smoke:*` | live (running app + seed) |
| `npm run sync:ai-matrix[:check]` | `../llm` → `containers/{llm,ocr}` |
| `npm run sync:cursor-rules` | `docs/knowledge/ved-*.mdc` → `.cursor/rules/` |
