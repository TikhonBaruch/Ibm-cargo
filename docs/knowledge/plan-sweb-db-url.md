# План: канон доступа к Postgres LBM (sweb `newlsu_lbm`)

Индекс: [`database.md`](./database.md) · [`environments.md`](./environments.md) · [`runbook.md`](./runbook.md).  
Ветвь 3 (ядро). D33 / **D36** (только БД LBM, не taurus).

## 1. Идея

В репозитории должен быть **верный shape** боевого `DATABASE_URL` для Ibm-cargo: хост, порт, пользователь, имя БД, SSL. Пароль — только в gitignored `.env` / Vercel, не в git.

Проверка 2026-08-26: Prisma с `sslmode=require` коннектится к `pg4.sweb.ru:5433` / `newlsu_lbm`. Сиды (`npm run db:seed`) на эту БД прошли.

## 2. Анализ

| Симптом | Причина |
|---------|---------|
| `.env.example` с `HOST:5432` и плейсхолдерами `USER`/`DB` | Шаблон не совпадал с as-is sweb |
| Строка с `#` внутри «пароля» → Prisma Authentication failed | `#` — фрагмент URL, **не** символ пароля. WHATWG `new URL` на таком вводе бросает `Invalid URL`. `%23` вместо вырезанного `#` тоже **не** логинит |
| `:5433:/dbname` | Лишнее двоеточие после порта — `Invalid URL` / invalid port |
| Порт **5432** + `sslmode=require` | TLS handshake: server does not support TLS |
| Агент читает `app/.env` → Authentication failed / «нет файла» | `app/` — App Router, **не** пакет. Prisma/Next грузят **корневой** `.env`. На Cloud VM 2026-08-26 `app/.env` нет |
| `process.env.DATABASE_URL=[SENSITIVE]` | `vercel env pull` / инъекция Cloud. `loadEnvFile` не перезапишет — нужен `env -u DATABASE_URL` |
| Пароль в KB / `.env.example` | Нарушение инварианта 8 (секреты не коммитить) |

Не делать: коммитить боевой URL; нацеливать Prisma на taurus/llm (D36); dump/restore с taurus-liart (D37).

## 3. Структурирование

| Фаза | Что |
|------|-----|
| U1 | Канон в [`database.md`](./database.md): таблица host/port/user/db + шаблон без пароля + ловушки `#` и `:port:/` |
| U2 | `.env.example` / `docker.env.example` — тот же host:port/db |
| U3 | Runbook / deploy / Preview / environments — ссылка на канон |
| U4 | Unit `parsePostgresUrl`: as-is shape + paste-pitfall `#` |
| U5 | Lookup order для агентов: root `.env` / `.env.local` → `prisma/.env`; **не** `app/.env`; **не** git; **не** `vercel env pull` |

## 4. Реализация

- Канон: [`database.md`](./database.md) (host/port + **lookup order**).
- Шаблон: `.env.example` (пароль = `YOUR_PASSWORD`).
- Prisma CLI: `prisma.config.ts` грузит только `.env` и `prisma/.env` из **cwd** (корень репо), не `app/.env`.
- Тест: `src/lib/ved/__tests__/infra-access.test.ts` + `src/lib/__tests__/vercel-root.test.ts` (список файлов в `prisma.config.ts`).

Локально: `cp .env.example .env`, подставить пароль, `env -u DATABASE_URL npm run db:seed` (если в процессе уже висит плейсхолдер Vercel `[SENSITIVE]`, `loadEnvFile` его не перезапишет).

Не создавать `app/.env` «чтобы Next его увидел» — не увидит. Не сбрасывать пароль sweb из агента (нет панели).

## 5. Закрытие

KB обновлён; пароль не в diff. Проверка: unit `infra-access` + `vercel-root` + `npm run test:ci`.  
Live 2026-08-26: корневой `.env` (hash-stripped) — Prisma auth OK на `newlsu_lbm`; `app/.env` отсутствует.
