# Разработка

Карта сред (Mode A / Compose / Vercel): [`knowledge/environments.md`](./knowledge/environments.md).  
Ops checklist: [`knowledge/runbook.md`](./knowledge/runbook.md).

## Требования

- Node.js 22+
- npm
- Docker + Docker Compose (для контейнеров)
- PostgreSQL (Compose или внешняя БД)

## Режим A — один Next

```bash
npm run setup      # .env + install (первый запуск)
npm run setup:db   # + prisma db push + seed
npm run dev        # :3000
```

Карта сред: [`knowledge/environments.md`](./knowledge/environments.md) · preview: [`knowledge/staging.md`](./knowledge/staging.md).

Ручной путь:

```bash
cp .env.example .env   # или docker.env.example → .env
npm install
npx prisma db push
npx prisma db seed     # demo: client@ / broker@ / operator@ / admin@ (ADMIN) · demo1234
npm run dev            # :3000
```

AI/API stubs без полного стека:

```bash
npm run docker:core
# AI_SERVICE_URL=http://localhost:4100  (опционально)
```

Или без Docker:

```bash
node containers/ai/src/index.js      # :4100
node containers/api/src/index.js     # :4000
```

## Режим B — параллельные контейнеры

| Роль | Папка | Порт | Команда / профиль |
|------|-------|------|-------------------|
| API | `containers/api` | 4000 | `docker compose --profile core up` |
| AI draft | `containers/ai` | 4100 | core |
| Worker SLA | `containers/worker` | 4200 | core |
| LLM enrich | `containers/llm` | 4500 | `docker:scale` / `full` |
| Payments | `containers/payments` | 4300 | scale / full |
| Notify | `containers/notify` | 4400 | scale / full |
| Logistics | `containers/logistics` | 4600 | scale / full |
| Web | корень / `containers/web` | 3000 | `docker:web` |
| Admin / Broker / Client | surfaces | 3001–3003 | `docker:split` |
| Gateway | `containers/gateway` | 8080 | `docker:full` |

```bash
npm run docker:core    # postgres redis api ai worker
npm run docker:web     # + Next monolith
npm run docker:split   # + admin/broker/client UI
npm run docker:scale   # + payments notify llm logistics
npm run docker:full    # всё + gateway :8080
```

Без Docker (отдельные процессы):

```bash
node containers/api/src/index.js
node containers/ai/src/index.js
node containers/worker/src/index.js
node containers/llm/src/index.js
node containers/payments/src/index.js
node containers/notify/src/index.js
node containers/logistics/src/index.js
```

## Структура

```text
lbm-broker/  # каталог репозитория Ibm-cargo
  app/ src/ prisma/ public/     # Next monolith UI (Vercel)
  containers/
    web/ admin/ broker/ client/ # UI surfaces (без Prisma)
    api/ ai/ worker/            # ядро backend
    payments/ notify/ llm/ logistics/  # growth stubs
    gateway/ postgres/ redis/   # infra
  docs/
    knowledge/                  # ADR, ветви, тесты, диалоги
    contracts/                  # JSON envelopes по контейнерам
  scripts/smoke-*-path.mjs      # live happy-path
  docker-compose.yml
```

## Тесты (CI)

Перед сдачей фичи:

```bash
npm run test:ci
# = unit → structure → contracts → verify (≥90 passed)
```

| Команда | Назначение |
|---------|------------|
| `npm run test:unit` | Vitest `src/` (domain, invariants, calc) |
| `npm run test:structure` | Ownership, forbidden synthetic, docs |
| `npm run test:contracts` | `docs/contracts/*` envelopes |
| `npm run test:verify` | Повтор unit + порог |
| `npm run test:e2e` | Opt-in deploy probe (`RUN_E2E=1`) |

Матрица клиент / брокер / ядро: [`knowledge/testing-branches.md`](./knowledge/testing-branches.md).  
Индекс: [`knowledge/testing.md`](./knowledge/testing.md).

### Smoke (живой сервер)

Нужны `npm run dev` (или compose web) + seed. Демо-пароль `demo1234`.

```bash
npm run smoke:full     # S1–S3: upload → STANDARD → pay → claim → approve
npm run smoke:broker   # PATCH mapping → approve
npm run smoke:client   # EXPRESS create/pay niche
npm run smoke:chat     # S4 waitingOn flip
# TEST_API_URL=http://localhost:3000 npm run smoke:full
```

## Параллельная разработка и масштабирование

Диалоги ядра (S1–S6): [`knowledge/core-dialogues.md`](./knowledge/core-dialogues.md).  
Контракты (один файл = один независимо версионируемый envelope): [`contracts/`](./contracts/).

| Контейнер | Контракт(ы) | Можно делать параллельно |
|-----------|-------------|--------------------------|
| `api` | d-calc, d-queue, d-map, d-thread, d-ledger | domain routes / proxy |
| `ai` | d-draft.ai | draft engine; вызов llm |
| `llm` | d-draft.llm | classify/duty |
| `worker` | d-job | SLA tick / Redis |
| `notify` | d-event | templates |
| `payments` | d-ledger (webhook) | checkout |
| `logistics` | d-ship | quotes after DONE |

### Профили Compose (scale path)

```text
core → web → split → scale → full
```

Карта C1–C5: [`knowledge/containerization.md`](./knowledge/containerization.md).  
C1 Compose ready / Vercel dual; C2–C4 done as designed; C5 slim = scaffold.

### Правила scale (не ломать)

1. **Один PR ≈ один контейнер** + свой файл в `docs/contracts/` (D19).
2. UI-контейнеры **без** `@prisma/client` (D16/D17/D20).
3. LLM только через `containers/ai` — UI/браузер не зовут `:4500`.
4. Очередь брокера только после pay (D11); без `id: "synthetic"` (D15).
5. Session face: браузер → `/api/v1` (web) → opt-in `USE_DOMAIN_API` → `api:4000`.

## Соглашения

1. Реальные AI-модели — отдельная задача поверх stub llm/ai.
2. Канон UI: `docs/design/refs/` (если есть).
3. Legacy CMS не расширять как лицо продукта (D6).
4. Секреты не коммитить.
5. Не параллелить admin + AI + payments в одном PR.

## Деплой (GitHub → Vercel)

Checklist env, ignore и порядок push: [`knowledge/deploy.md`](./knowledge/deploy.md).  
Прод: https://ibm-cargo.vercel.app — без `USE_DOMAIN_API` (Prisma в Next).

