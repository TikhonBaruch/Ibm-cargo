# LBM (Ibm-cargo)

Автономный продукт **LBM**. Репозиторий: `TikhonBaruch/Ibm-cargo`.

## Структура

```
Ibm-cargo/
  app/          # Next.js App Router (routes)
  src/ prisma/ containers/  # domain + UI + compose
  llm/          # AI matrix
  docs/
```

Vercel **Root Directory = `.`** (Next в корне репо — так деплой проходит без ручного Root=`app`).

## Старт

```bash
cp .env.example .env   # или готовый .env с newlsu_lbm
npm ci
npx prisma db push && npx prisma db seed
npm run dev            # http://localhost:3000
```

- UI lab: `/client`
- Функция: `/cabinet`
- Demo: `client@example.com` / `demo1234`

## Vercel Env (минимум)

`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `ALLOW_MOCK_TOPUP=1`, `CRON_SECRET`
