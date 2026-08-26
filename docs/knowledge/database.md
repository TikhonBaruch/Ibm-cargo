# База данных LBM Брокер

Провайдер: PostgreSQL (внешний host в `DATABASE_URL`).  
SSL на prod: `sslmode=require` (при необходимости `uselibpqcompat=true` для node-pg / Prisma).

Секреты и боевой хост только в `.env` / `.env.local` / Vercel (не коммитить).  
Публичный `/login` по-прежнему показывает демо-учётки. Obscure SUPER path/email в коде закодированы; `robots.txt` obscure-пути не перечисляет.

**D36:** эта БД и миграции/seed/`db push` относятся **только** к LBM (ibm-cargo). Запрещено нацеливать Prisma/Compose LBM на БД, volume или `.env` **taurus/llm** или nested `./llm`. Матрица AI не шарит Postgres с LBM.

SUPER UI: блок «Инфраструктура и доступы» читает `DATABASE_URL` и опциональные `OPS_*` через `GET /api/admin/infra` (только `SUPER_ADMIN`). Seed-пароль в эту панель не кладём.

```env
DATABASE_URL="postgresql://newlsu_lbm:YOUR_PASSWORD@pg4.sweb.ru:5433/newlsu_lbm?schema=public&connect_timeout=15&sslmode=require"
```

Пароль — только `.env` / `.env.local` / Vercel. Не коммитить боевой URL. План: [`plan-sweb-db-url.md`](./plan-sweb-db-url.md).

### As-is sweb (проверено 2026-08-26)

| Поле | Значение |
|------|----------|
| Провайдер | Timeweb / sweb PostgreSQL |
| Host | `pg4.sweb.ru` |
| Port | **5433** (SSL). `5432` открыт, но TLS нет — `sslmode=require` падает на handshake |
| User | `newlsu_lbm` |
| Database | `newlsu_lbm` |
| SSL | `sslmode=require` |
| Пароль | **без** `#` `@` `/` — в URL как есть, `%23` не нужен |

Ловушки при копировании строки:

1. Символ `#` в «пароле» — это **фрагмент URL**, не часть пароля. `new URL(...)` → `Invalid URL`; Prisma → Authentication failed.
2. Лишнее двоеточие `:5433:/newlsu_lbm` — тоже `Invalid URL`. Нужно `:5433/newlsu_lbm`.
3. `env -u DATABASE_URL` перед `npm run db:seed`, если в процессе уже стоит плейсхолдер Vercel `[SENSITIVE]` — `prisma.config.ts` / `loadEnvFile` его не перезапишет.

Если позже в пароле появятся `#` `@` `/` — URL-encode (`#` → `%23`).

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
