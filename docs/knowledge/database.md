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

1. Символ `#` в «пароле» — это **фрагмент URL**, не часть пароля. `new URL(...)` → `Invalid URL`; Prisma → Authentication failed. Рабочий пароль = конкатенация **до и после** `#` (сам `#` выкинуть). **Не** кодировать `#` как `%23` — такая строка тоже даёт Authentication failed.
2. Лишнее двоеточие `:5433:/newlsu_lbm` — тоже `Invalid URL` / invalid port. Нужно `:5433/newlsu_lbm`.
3. `env -u DATABASE_URL` перед `npm run db:seed` / Prisma CLI, если в процессе уже стоит плейсхолдер Vercel `[SENSITIVE]` — `prisma.config.ts` / `loadEnvFile` его не перезапишет.

Если позже в пароле появятся `#` `@` `/` — URL-encode (`#` → `%23`). На as-is sweb 2026-08-26 `%23` **не** нужен.

### Где агентам брать `DATABASE_URL`

Порядок (пароль не печатать, `.env*` не коммитить):

| # | Источник | Когда |
|---|----------|--------|
| 1 | **`/workspace/.env`** (repo-root `.env` / `.env.local`) | **Канон.** Next.js и `prisma.config.ts` читают **cwd = корень репо**. Не удалять. |
| 2 | **`/workspace/app/.env`** | **Дубликат канона** для агентов, которые открывают каталог `app/` (App Router, не пакет). Next/Prisma CLI этот файл **не** грузят. |
| 3 | **`prisma/.env`** | Второй файл, который грузит Prisma CLI (`prisma.config.ts`), если файл есть. |
| — | git | Секреты gitignored (`.env*` покрывает `app/.env` и `prisma/.env`). |
| — | `vercel env pull` | Плейсхолдер `[SENSITIVE]` — Prisma: URL must start with `postgresql://`. Не источник пароля. |

Проверка 2026-08-26 (Cloud VM): корневой `.env` — `$queryRaw SELECT current_database()` → `newlsu_lbm`. Тот же рабочий URL продублирован в `app/.env` и `prisma/.env` (gitignored). `process.env.DATABASE_URL=[SENSITIVE]` — fail. Сырой paste с `#` + `:5433:/db` — invalid port. `%23` и «пароль только до `#`» — Authentication failed.

План: [`plan-sweb-db-url.md`](./plan-sweb-db-url.md).

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
