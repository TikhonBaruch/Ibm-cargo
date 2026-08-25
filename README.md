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
