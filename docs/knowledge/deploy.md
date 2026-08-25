# GitHub + Vercel deploy

Проект уже связан с remote и Vercel. Этот checklist — безопасная выкладка без секретов и тяжёлых ассетов.

Канон live LBM: https://taurus-liart.vercel.app  
`https://ibm-cargo.vercel.app` — чужой Vercel-проект, не этот репозиторий. Этот git-репозиторий деплоится как Vercel project **ibm-cargo** → **Preview URL** (SSO).  
Remote: `git@github.com:TikhonBaruch/Ibm-cargo.git`  
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
| `NEXTAUTH_URL` | origin **этого** деплоя (Preview branch URL). **Не** `https://ibm-cargo.vercel.app` — чужой проект |
| `NEXT_PUBLIC_SITE_URL` | Тот же origin |
| `ALLOW_MOCK_TOPUP` | `1` для демо mock-пополнения баланса (D13); без флага mock topup в production отключён |
| `CRON_SECRET` | **Required** for Vercel Cron auth: platform sends `Authorization: Bearer <CRON_SECRET>` only if this env exists. Used by `/api/v1/internal/sla-tick` and `/api/v1/internal/jobs-tick`. Fallback to `NEXTAUTH_SECRET` only for manual/`x-internal-key` calls — **not** for Vercel Cron. |
| `S3_BUCKET` / `S3_ENDPOINT` / `S3_REGION` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | **Нужны на prod** для VED uploads (`/api/v1/uploads`); без них → 503 |
| `NEXT_PUBLIC_SHIPPING_UI` | опционально `1` — показать UI «Перевозка» (default off; код сохранён) |
| `NEXT_PUBLIC_FACTORY_UI` | на **Vercel Pro** Production/Preview = `1` (завод / SKU / admin «Производители»). Shipping по-прежнему off. |

Опционально: Telegram.  
**Не** ставить на Vercel: `USE_DOMAIN_API=1`, docker DNS (`http://ai:4100`, `http://api:4000`).  
**Qwen / DeepSeek on Vercel:** `LLM_PROVIDER=deepseek` + `DEEPSEEK_API_KEY` (+ optional `QWEN_API_KEY` / `QWEN_VISION_MODEL`) на Production+Preview. Next вызывает провайдеров напрямую (`provider-mesh`, кандидаты из `TnvedCode`); не нужен публичный `LLM_SERVICE_URL`. Create `maxDuration=60`. Fail-open + брокер-QC.

**Preview:** скопировать тот же набор ключей (включая `S3_*` и auth). `DATABASE_URL` — Postgres **`newlsu_lbm` с seed**; без seed `/login` даст «неверный пароль» (можно `/register`). NextAuth v4: задать **`NEXTAUTH_SECRET`** (не только `AUTH_SECRET`). На Preview не копировать `NEXTAUTH_URL=https://ibm-cargo.vercel.app` (чужой хост); код подставляет `VERCEL_BRANCH_URL`. Канон: [`plan-preview-auth.md`](./plan-preview-auth.md).

**Vercel Pro (2026-08-20):** `NEXT_PUBLIC_FACTORY_UI=1` на Production/Preview; cron `jobs-tick` каждые 15 мин (+ daily `sla-tick`). Build не делает `migrate deploy` — схема на sweb отдельно; не `WEB_SURFACE=slim`; не второй Postgres; Compose на Vercel не крутится. Отдельный проект `manufacturer` — ignore build + без git; UI `/manufacturer` из root. Канон: [`feature-cycle.md`](./feature-cycle.md) шаг 8.

**Hobby (история D33):** на free cron был только daily — на Pro `*/15` OK.

**ТН ВЭД:** не коммитить `scripts/data/tnved/raw/` и `normalized/` (gitignore). Не `tnved:load -- --full` на sweb — Preview и Production делят одну БД. Ставки TWS только local Compose postgres. Канон: [`plan-tnved-collect.md`](./plan-tnved-collect.md).

После смены схемы: `npx prisma db push` (или migrate) **на prod DB отдельно** — Vercel build делает только `prisma generate` через `postinstall`.

### Build pitfalls

- Route handlers с Prisma **не** должны быть статически prerendered (`revalidate` без `force-dynamic`) — иначе `Environment variable not found: DATABASE_URL` на `next build` (случай `/api/promos`).
- Публичный `POST /api/v1/auth/register` должен быть в `isPublicAuthedPath` и пропускаться middleware до RBAC без сессии (D25).
- `npm warn allow-scripts … not yet covered by allowScripts` — advisory npm 11.16+ (скрипты всё ещё бегут). В корневом `package.json` поле `allowScripts` (имя + pin lockfile: Prisma 6.19.3, sharp **0.35.3** не 0.34.5, tesseract.js, unrs-resolver). Не `ignore-scripts`. На npm 10 предупреждения нет.
- `The configuration property package.json#prisma is deprecated` — seed в `prisma.config.ts` (Prisma 6.19 `defineConfig` из `prisma/config`). Не Prisma 7. URL БД остаётся `env("DATABASE_URL")` в `prisma/schema.prisma`.
- `WARNING! Build output contains no "functions" or "static" directory` — **фатально:** Framework = Other/Static, не **Services**. Next пишет `.next/`, не `functions/`/`static/`. Не путать с двумя warn выше. Клики: [`plan-vercel-services.md`](./plan-vercel-services.md) §9.
- `Project framework is set to "services", but no services are declared` — Preset **уже** Services, но прочитанный `vercel.json` без `services`. На этой ветке блок **есть** в корне. Типично: Redeploy **Production/`main`** (корневого json нет, он в `app/vercel.json`) или Root Directory = `app`. Не убирать `services`. Клики: [`plan-vercel-services.md`](./plan-vercel-services.md) §10.
- `Warning: Could not identify Next.js version` / `Error: No Next.js version detected` — Root Directory в Dashboard не `.` (часто `app`) или Framework Preset не **Services**. `"next"` уже в корневом `package.json`. См. [`plan-vercel-services.md`](./plan-vercel-services.md) §8.

## Vercel project settings

Dashboard (агент **не** может выставить эти поля). Проект: [ibm-cargo](https://vercel.com/tikhonbaruchs-projects/ibm-cargo), GitHub `TikhonBaruch/Ibm-cargo`. **Не** путать с Production URL `https://ibm-cargo.vercel.app` (чужой проект).

| Setting | Значение | Где кликать |
|---------|----------|-------------|
| **Root Directory** | `.` (корень репо; поле пустое или `.`) | **Settings** → **Build and Deployment** (или **General**) → **Root Directory** → **Edit** → не `app` / не `lint` / не вложенная папка → **Save** |
| **Framework Preset** | **Services** | **Settings** → **General** → **Framework Preset** → **Services** → **Save** |
| Install | `npm install` (`postinstall` → `prisma generate`) | не Override, пока не нужно |
| Build | `npm run build` (берётся из frontend Next) | не Override |

`vercel.json` **обязан** содержать блок `services` (канон [`vercel.services.bff.json`](../../vercel.services.bff.json)): frontend `root: "."` + `framework: "nextjs"`, backend `Dockerfile.vercel`. Нельзя писать `"rootDirectory"` в json (invalid).

**Ошибка** `No Next.js version detected` / `Could not identify Next.js version` = билдер смотрит не в корневой `package.json` (там уже `"next": "16.1.6"`). Почти всегда Dashboard Root Directory = `app` или Framework ≠ Services. Канон и клики: [`plan-vercel-services.md`](./plan-vercel-services.md) §8.

**Ошибка** `Build output contains no "functions" or "static" directory` = generic Static/Other builder. Канон: [`plan-vercel-services.md`](./plan-vercel-services.md) §9.

**Ошибка** `Project framework is set to "services", but no services are declared` = билдер не нашёл `services` в Root Directory. На PR-ветке json в **корне** уже с `services`; не Redeploy `main`/Production до merge. Канон: [`plan-vercel-services.md`](./plan-vercel-services.md) §10. BFF: `/api/*` на `frontend`; Docker через Node `ved/proxy`, не browser→container.

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
6. Smoke/e2e против Preview этого репозитория (не ibm-cargo.vercel.app):

```bash
TEST_API_URL=https://<preview>.vercel.app RUN_E2E=1 npm run test:e2e
# или живой LBM-ориентир:
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
