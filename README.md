# LBM (Ibm-cargo)

Автономный продукт **LBM**. Репозиторий: `TikhonBaruch/Ibm-cargo`.

Отдельная **Postgres** и S3 bucket **`lbm`**. Имя taurus в проекте не используется.

## Структура

```
Ibm-cargo/
  app/          # Next.js + domain + UI lab (/client)
  llm/          # AI matrix + tnved data
  docs/
  PLATFORMS.md
```

Vercel **Root Directory = `app`**.

## Vercel Env (минимум)

Production **и** Preview:

| Variable | Пример |
|----------|--------|
| `DATABASE_URL` | Postgres LBM; `#` в пароле → `%23` |
| `NEXTAUTH_SECRET` | `openssl rand -hex 32` |
| `NEXTAUTH_URL` | origin деплоя (`https://….vercel.app`) |
| `NEXT_PUBLIC_SITE_URL` | тот же origin |
| `ALLOW_MOCK_TOPUP` | `1` |
| `CRON_SECRET` | случайная строка |

Опционально: `S3_*` (bucket `lbm`), `RESEND_API_KEY`.  
После смены env — **Redeploy**.

## Секреты

Только `app/.env` (gitignore) или Vercel Env.  
Шаблон: `app/.env.example`. Заметки доступов: `lbm.txt` (gitignore).

## Старт

```bash
cd app
npm ci   # при необходимости
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

- Функция: `/cabinet`
- UI lab: `/client`
- Demo после seed: `client@example.com` / `demo1234`
