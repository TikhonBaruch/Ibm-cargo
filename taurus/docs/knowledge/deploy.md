# GitHub + Vercel deploy

Проект уже связан с remote и Vercel. Этот checklist — безопасная выкладка без секретов и тяжёлых ассетов.

Прод UI: https://taurus-liart.vercel.app (hostname Vercel пока `taurus-liart`; бренд LBM Брокер)  
Remote: `https://github.com/TikhonBaruch/Ibm-cargo` (самостоятельный продукт **ibm-cargo**; не upstream `TikhonBaruch/taurus`)  
Локальная разработка: [`../development.md`](../development.md).  
Карта сред (local vs Compose vs prod): [`environments.md`](./environments.md).  
Preview / prod smoke: [`staging.md`](./staging.md). План: [`roadmap.md`](./roadmap.md).

## Что не коммитить

| Путь | Почему |
|------|--------|
| `.env*` (кроме `.env.example`) | Секреты |
| `.vercel/` | Local project link + prod env cache |
| `new_desing/` | Design dump (~15MB), не runtime |
| `Таурус/` | PDF/материалы, не runtime |
| `.cursor/` | Локальные agent rules/plans |

См. [`.gitignore`](../../.gitignore) и [`.vercelignore`](../../.vercelignore).

## Env на Vercel (минимум)

| Variable | Пример / заметка |
|----------|------------------|
| `DATABASE_URL` | Postgres (sweb или другой); URL-encode спецсимволы в пароле |
| `NEXTAUTH_SECRET` | Длинный random secret |
| `NEXTAUTH_URL` | `https://taurus-liart.vercel.app` (точный origin деплоя; на Preview — origin preview URL) |
| `NEXT_PUBLIC_SITE_URL` | Тот же origin |
| `ALLOW_MOCK_TOPUP` | `1` для демо mock-пополнения баланса (D13); без флага mock topup в production отключён |
| `CRON_SECRET` | **Required** for Vercel Cron auth: platform sends `Authorization: Bearer <CRON_SECRET>` only if this env exists. Used by `/api/v1/internal/sla-tick` and `/api/v1/internal/jobs-tick`. Fallback to `NEXTAUTH_SECRET` only for manual/`x-internal-key` calls — **not** for Vercel Cron. |
| `S3_BUCKET` / `S3_ENDPOINT` / `S3_REGION` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | **Нужны на prod** для VED uploads (`/api/v1/uploads`); без них → 503 |
| `NEXT_PUBLIC_SHIPPING_UI` | опционально `1` — показать UI «Перевозка» (default off; код сохранён) |
| `NEXT_PUBLIC_FACTORY_UI` | на **Vercel Pro** Production/Preview = `1` (завод / SKU / admin «Производители»). Shipping по-прежнему off. |

Опционально: Telegram.  
**Не** ставить на Vercel: `USE_DOMAIN_API=1`, docker DNS (`http://ai:4100`, `http://api:4000`).  
**Qwen / DeepSeek on Vercel:** `LLM_PROVIDER=deepseek` + `DEEPSEEK_API_KEY` (+ optional `QWEN_API_KEY` / `QWEN_VISION_MODEL`) на Production+Preview. Next вызывает провайдеров напрямую (`provider-mesh`, кандидаты из `TnvedCode`); не нужен публичный `LLM_SERVICE_URL`. Create `maxDuration=60`. Fail-open + брокер-QC.

**Preview:** скопировать тот же набор ключей, что Production (включая `S3_*` и auth). Иначе preview-деплой падает на signup/upload/pay.

**Vercel Pro (2026-08-20):** `NEXT_PUBLIC_FACTORY_UI=1` на Production/Preview; cron `jobs-tick` каждые 15 мин (+ daily `sla-tick`). Build не делает `migrate deploy` — схема на sweb отдельно; не `WEB_SURFACE=slim`; не второй Postgres; Compose на Vercel не крутится. Отдельный проект `manufacturer` — ignore build + без git; UI `/manufacturer` из root. Канон: [`feature-cycle.md`](./feature-cycle.md) шаг 8.

**Hobby (история D33):** на free cron был только daily — на Pro `*/15` OK.

**ТН ВЭД:** не коммитить `scripts/data/tnved/raw/` и `normalized/` (gitignore). Не `tnved:load -- --full` на sweb — Preview и Production делят одну БД. Ставки TWS только local Compose postgres. Канон: [`plan-tnved-collect.md`](./plan-tnved-collect.md).

После смены схемы: `npx prisma db push` (или migrate) **на prod DB отдельно** — Vercel build делает только `prisma generate` через `postinstall`.

### Build pitfalls

- Route handlers с Prisma **не** должны быть статически prerendered (`revalidate` без `force-dynamic`) — иначе `Environment variable not found: DATABASE_URL` на `next build` (случай `/api/promos`).
- Публичный `POST /api/v1/auth/register` должен быть в `isPublicAuthedPath` и пропускаться middleware до RBAC без сессии (D25).

## Vercel project settings

- Root Directory: `.` (корневой Next monolith)
- Install: `npm install` (`postinstall` → `prisma generate`)
- Build: `npm run build`
- Framework: Next.js (prod). Services cutover: [`plan-vercel-services.md`](./plan-vercel-services.md) §7; канон [`vercel.services.bff.json`](../../vercel.services.bff.json) → в `vercel.json` только вместе с Framework=Services. BFF: `/api/*` на `frontend`; Docker через Node `ved/proxy`, не browser→container.

## Порядок ship

### A — Push уже закоммиченного

Если `main` ahead of `origin/main`, а WIP ещё не готов:

```bash
git status -sb
git push -u origin HEAD
```

WIP остаётся локально; Vercel задеплоит только то, что в remote.

### B — Подготовить WIP

1. Убедиться, что `new_desing/`, `Таурус/`, `.cursor/` ignored.
2. `npm run test:ci`
3. `npm run build`
4. Коммит осмысленными кусками (D19: лучше не мешать api+ai+payments в один PR без нужды) — **только по явной просьбе**.
5. `git push` → auto-deploy.
6. Smoke/e2e против прода:

```bash
TEST_API_URL=https://taurus-liart.vercel.app RUN_E2E=1 npm run test:e2e
# или
TEST_API_URL=https://taurus-liart.vercel.app npm run smoke:mvp
TEST_API_URL=https://taurus-liart.vercel.app npm run smoke:full
```

### C — После деплоя

- Login demo: `client@example.com` / `broker@example.com` / `operator@example.com` / `admin@example.com` (ADMIN) / `demo1234`
- Create → pay (или EXPRESS DONE)
- При schema drift — `prisma db push` на prod DB

## Известные ограничения

- Compose containers (`llm`, `payments`, …) на Vercel **не** крутятся; monolith Next достаточен для MVP UI.
- Split UI (`containers/client|broker`) — для Docker; прод-кабинеты в корневом Next (`/cabinet`, `/broker`).
