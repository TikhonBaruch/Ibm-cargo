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

Vercel: **Root = `.`**, **Framework = Services**. Корневой `vercel.json` с `services` обязателен (`frontend.root: "."`, `backend` → `Dockerfile.vercel`). Канон: `vercel.services.bff.json`.  
Не использовать форму PR #5 (`frontend.root: "app"`) после hoist Next в корень. Не `https://ibm-cargo.vercel.app`.  
Ошибка *No Next.js version detected* = Dashboard Root Directory не `.` (не `app`); `"next"` уже в корневом `package.json`.

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

## LLM / OCR / mesh (полная копия исходного продукта (mesh + Next))

Как у исходного проекта: Compose **Mode B**, UI может оставаться `npm run dev`.

```bash
npm run docker:scale    # postgres redis api ai worker + llm ocr payments notify logistics
# .env (host Next):
#   LLM_SERVICE_URL=http://127.0.0.1:4500
#   OCR_SERVICE_URL=http://127.0.0.1:4700
#   AI_SERVICE_URL=http://127.0.0.1:4100
#   QWEN_API_KEY / DEEPSEEK_API_KEY — живые модели; без ключей = lexical/stub
```

Без Docker на машине (тот же HTTP-контур):

```bash
npm run mesh:up         # llm:4500 ocr:4700 ai:4100 api:4000 worker payments notify logistics
npm run mesh:health
```

На **Vercel** контейнеры не крутятся: те же ключи (`LLM_PROVIDER=deepseek`, `DEEPSEEK_API_KEY`, `QWEN_API_KEY`) — Next зовёт провайдеров напрямую (`provider-mesh`). Не ставить `LLM_SERVICE_URL=http://llm:…`.

## Vercel Env (минимум)

`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `ALLOW_MOCK_TOPUP=1`, `CRON_SECRET`
