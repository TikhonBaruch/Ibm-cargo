# LBM (Ibm-cargo)

Автономный продукт **LBM**. Репозиторий: `TikhonBaruch/Ibm-cargo`.

Отдельная **Postgres** и S3 bucket **`lbm`**. Чужие репозитории/БД/S3 в runtime не использовать.

## Структура

```
Ibm-cargo/
  app/          # Next.js + domain + UI lab (/client)
  llm/          # AI matrix + tnved data
  docs/         # architecture-map, plan-lbm-bro-skin, …
  PLATFORMS.md
```

Карта связей: [`docs/architecture-map.md`](docs/architecture-map.md).  
Внедрение UI lab: [`docs/plan-lbm-bro-skin.md`](docs/plan-lbm-bro-skin.md).

Vercel **Root Directory = `app`**.

## Секреты

| Файл | Назначение |
|------|------------|
| `app/.env` | **единственный** `DATABASE_URL` + `S3_*` (+ NextAuth / ключи) |
| `app/.env.local` | опционально localhost UI / mock — **без** override DB/S3 |
| `app/.env.example` / `app/.env.local.example` | шаблоны в git |
| `lbm.txt` | заметки доступов (gitignore) |
| repo `.env.local` | CLI/OIDC; Next из `app/` не читает |

Шаблон: [`app/.env.example`](app/.env.example).

## Старт (Mode A)

```bash
cd app
npm ci   # при необходимости
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

- UI lab: `/client` (скин lbm-bro)
- Функция: `/cabinet` (+ `/broker`, `/admin`)
- Demo после seed: `client@example.com` / `demo1234`

Проверка БД: `cd app && npx tsx scripts/verify-db.ts`
