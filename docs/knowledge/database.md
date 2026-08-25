# База данных LBM Брокер

Провайдер: PostgreSQL (внешний host в `DATABASE_URL`).  
SSL на prod: `sslmode=require` (при необходимости `uselibpqcompat=true` для node-pg / Prisma).

Секреты и боевой хост только в `.env` / `.env.local` / Vercel (не коммитить).  
Публичный `/login` по-прежнему показывает демо-учётки. Obscure SUPER path/email в коде закодированы; `robots.txt` obscure-пути не перечисляет.

**D36:** эта БД и миграции/seed/`db push` относятся **только** к LBM (ibm-cargo). Запрещено нацеливать Prisma/Compose LBM на БД, volume или `.env` проекта **taurus/llm**. Матрица AI не шарит Postgres с LBM.

SUPER UI: блок «Инфраструктура и доступы» читает `DATABASE_URL` и опциональные `OPS_*` через `GET /api/admin/infra` (только `SUPER_ADMIN`). Seed-пароль в эту панель не кладём.

```env
DATABASE_URL="postgresql://USER:<PASSWORD>@HOST:PORT/DB?schema=public&connect_timeout=15&sslmode=require"
```

**As-is (Ibm-cargo / `newlsu_lbm` на sweb):** пароль БД **без** символа `#` — в `DATABASE_URL` его можно писать как есть, `%23` не нужен.  
Если позже снова появятся спецсимволы в пароле (`#`, `@`, `/`, …) — URL-encode (`#` → `%23`). Не коммитить боевой URL.

## Схема и миграции

- Канон моделей: `prisma/schema.prisma`.
- На практике host часто синхронизируют через **`npx prisma db push`** (история `_prisma_migrations` может быть пустой).
- Предпочтительно: `npx prisma migrate deploy` после выравнивания migration history.
- Seed: `npx prisma db seed` (тарифы, demo users, heuristic **TN VED** листья — D24).

### БД-2 / pgvector (2026-08-12)

| Артефакт | Внешний shared host | Compose |
|----------|---------------------|---------|
| `verified_determinations` | **нужна** (`migrate deploy`) | нужна |
| `embedding vector(1024)` | часто **нет** — extension `vector` может отсутствовать | `pgvector/pgvector:pg17` |
| Runtime | `precedent-v1` (fingerprint/lexical) | + `precedent-v2` при ключе |

Миграция `20260812140000_precedent_embeddings` — **fail-open** (NOTICE + skip), чтобы `migrate deploy` на host без `vector` не блокировался.  
План hardening: [`plan-tech-debt.md`](./plan-tech-debt.md) · прецеденты: [`plan-precedent-bulk.md`](./plan-precedent-bulk.md).

VED data-model (attrs / `TnvedCode` / `CalculationEvent`): [`data-model.md`](./data-model.md).  
Очередность записей заявки: [`db-process.md`](./db-process.md).
