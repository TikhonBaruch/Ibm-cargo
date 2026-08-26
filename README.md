# LBM (Ibm-cargo)

Автономный продукт **LBM**. Репозиторий: `TikhonBaruch/Ibm-cargo`.  
**Отделён** от taurus/llm (D36): нет nested `llm/`, нет sync; матрица только opt-in HTTP.  
**Backup ядра (D37):** https://taurus-liart.vercel.app — read-only, **не трогать**. Активный контур: Vercel Preview `ibm-cargo` · local · Compose.

## Структура

```
Ibm-cargo/
  app/ src/ prisma/   # Next + domain + UI
  containers/         # Compose (в т.ч. LBM-owned llm/ocr)
  docs/knowledge/     # KB / ADR
```

Vercel: **Root = `.`**, **Framework = Services**.  
Не `https://ibm-cargo.vercel.app` (чужой статический проект).

## Старт (Mode A — канон MVP)

```bash
cp .env.example .env   # sweb: pg4.sweb.ru:5433/newlsu_lbm — подставить пароль; см. docs/knowledge/database.md
npm ci
npx prisma db push && npx prisma db seed
npm run dev            # http://localhost:3000
```

- Кабинет: `/cabinet` · брокер: `/broker` · админ: `/admin`
- Demo: `client@example.com` / `broker@example.com` / `admin@example.com` · `demo1234`
- Проверка: `npm run test:ci` · smoke: `TEST_API_URL=<preview-url> npm run smoke:mvp` (не taurus — D37)

MVP = heuristic ТН ВЭД → оплата → брокер-QC → PDF. **Без** LLM-сервиса и без taurus.

## LLM / OCR (opt-in, LBM-owned)

Compose (не nested matrix):

```bash
npm run docker:scale    # + containers/llm :4500, ocr :4700, …
# host .env:
#   LLM_SERVICE_URL=http://127.0.0.1:4500
#   OCR_SERVICE_URL=http://127.0.0.1:4700
```

Без Docker: `npm run mesh:up` (те же `containers/*`).  
Vercel: ключи `LLM_PROVIDER` / `DEEPSEEK_*` / `QWEN_*` → `provider-mesh` напрямую.

Corpus lookup (optional): файлы в `containers/llm/data/tnved/normalized/` — не из чужого репо.

## Vercel Env (минимум)

`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `ALLOW_MOCK_TOPUP=1`, `CRON_SECRET`, `S3_*`
