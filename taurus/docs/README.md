# Документация LBM Брокер

Индекс. Секреты не хранить в docs — только в `.env` / Vercel.

**Единая база знаний:** [`knowledge/README.md`](./knowledge/README.md) — карта ADR, ownership, диалогов, C1–C5 и правил обновления.  
Агенты: [`../AGENTS.md`](../AGENTS.md).

## Навигация

| Документ | Содержание |
|----------|------------|
| [knowledge/README.md](./knowledge/README.md) | **Единая KB** — индекс, слои, порядок чтения |
| [architecture.md](./architecture.md) | Архитектура, поверхности, поток данных |
| [containers.md](./containers.md) | Контейнеры, порты, профили Compose |
| [development.md](./development.md) | Локальная и параллельная разработка |
| [knowledge/environments.md](./knowledge/environments.md) | As-is карта сред: Mode A/B + Vercel |
| [knowledge/product.md](./knowledge/product.md) | Продукт, роли, тарифы, roadmap |
| [knowledge/target-client.md](./knowledge/target-client.md) | Целевой клиент, ценность, стратегия (D29) |
| [knowledge/design.md](./knowledge/design.md) | Индекс дизайн-KB (baseline, интерактив, parity) |
| [knowledge/design-baseline.md](./knowledge/design-baseline.md) | D14, токены, shell, навигация кабинетов |
| [knowledge/design-interactive.md](./knowledge/design-interactive.md) | Интерактивный дизайн веб + mobile wireframe |
| [knowledge/design-parity.md](./knowledge/design-parity.md) | Таблица экранов реф ↔ live, UI backlog |
| [knowledge/ai-pipeline.md](./knowledge/ai-pipeline.md) | Контракт AI → брокер |
| [knowledge/database.md](./knowledge/database.md) | PostgreSQL |
| [knowledge/decisions.md](./knowledge/decisions.md) | Зафиксированные решения |
| [knowledge/branches.md](./knowledge/branches.md) | Три ветви: клиент / брокер / ядро |
| [knowledge/core-dialogues.md](./knowledge/core-dialogues.md) | Диалоги ядра: client / broker / llm, S1–S6 |
| [contracts/](./contracts/) | JSON Schema envelopes по контейнерам |
| [knowledge/db-process.md](./knowledge/db-process.md) | Очередность DB / tx (D23) |
| [knowledge/runbook.md](./knowledge/runbook.md) | Local / compose / Vercel ops |
| [knowledge/staging.md](./knowledge/staging.md) | Preview + prod smoke |
| [knowledge/current-app.md](./knowledge/current-app.md) | As-is карта кода + интегрированные решения |
| [knowledge/data-model.md](./knowledge/data-model.md) | D24: товары / ТН ВЭД / история запросов |
| [knowledge/roadmap.md](./knowledge/roadmap.md) | Фазы, риски, зависимости |
| [knowledge/plan-mvp-polish.md](./knowledge/plan-mvp-polish.md) | Поэтапный план + матрица приоритизации фич (без logistics/LLM/acquiring) |
| [knowledge/skeleton.md](./knowledge/skeleton.md) | Каркас стабильности, ownership, запреты |
| [knowledge/monorepo.md](./knowledge/monorepo.md) | Таблица сервисов Compose |
| [knowledge/containerization.md](./knowledge/containerization.md) | Ответвления C1–C5, профили, что закрыто |
| [knowledge/web-slim.md](./knowledge/web-slim.md) | C5 slim / Vercel boundary (scaffold) |
| [knowledge/growth.md](./knowledge/growth.md) | Фаза E: перевозка, эквайринг, mobile, AI |
| [knowledge/testing.md](./knowledge/testing.md) | Vitest, structure gate, test:verify |
| [knowledge/testing-branches.md](./knowledge/testing-branches.md) | Матрица тестов клиент/брокер/ядро |
| [knowledge/deploy.md](./knowledge/deploy.md) | GitHub push + Vercel env/checklist |
| [../AGENTS.md](../AGENTS.md) | Правила для AI-агентов |
| [design/refs/](./design/refs/) | Канонические HTML-референсы |

## Быстрые ссылки

- Репозиторий: `/home/andrey/taurus`
- Прод (Vercel): https://taurus-liart.vercel.app
- Контейнеры: [`containers/`](../containers/)
- Compose: `docker-compose.yml`, шаблон env: `docker.env.example`
