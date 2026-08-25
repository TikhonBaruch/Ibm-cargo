# План: NextAuth на Vercel Preview (Configuration → «неверный пароль»)

Индекс: [`deploy.md`](./deploy.md) · [`environments.md`](./environments.md) · [`plan-vercel-services.md`](./plan-vercel-services.md).  
Ветвь 3 (ядро). D33.

## 1. Идея

Два разных сбоя на «Visit Preview»:

1. HTML NextAuth **Server error / server configuration** = `Configuration` / `NO_SECRET`.
2. После починки Configuration форма пишет **«Неверный email или пароль»** (`CredentialsSignin`) — `authorize` вернул `null`.

**Hostname `ibm-cargo.vercel.app` — не этот продукт.** Это Production alias **другого** Vercel-проекта (статический IBM Cargo, Uganda). Curl туда отдаёт чужой сайт. Этот репозиторий (`TikhonBaruch/Ibm-cargo`) живёт как **Vercel Preview проекта `ibm-cargo`** (SSO). Живой LBM-ориентир: https://taurus-liart.vercel.app. Код не должен использовать `ibm-cargo.vercel.app` как origin.

## 2. Анализ

| Симптом | Причина |
|---------|---------|
| HTML NextAuth «Server error» | Нет `NEXTAUTH_SECRET` в Node production |
| `AUTH_SECRET` есть, вход всё равно падает | v4 не читает `AUTH_SECRET` |
| `NEXTAUTH_URL=https://ibm-cargo.vercel.app` на Preview | CSRF/cookie на branch URL **и** чужой хост |
| После Configuration — Prisma `Environment variable not found: DATABASE_URL` на `user.findUnique` | Runtime Preview **без** `DATABASE_URL`. Не инлайнить `process.env.DATABASE_URL` на билде; lazy Prisma + `datasourceUrl`. |
| После Configuration — «неверный пароль» при живой БД | Нет seed в `newlsu_lbm` **или** на `/login` сокращения `client@` (seed = `client@example.com`) |
| Пустой env → `https://ibm-cargo.vercel.app` | Хардкод fallback в `site-url.ts` / sitemap / robots |
| `No Next.js version detected` / `Could not identify Next.js version` | Dashboard Root Directory ≠ `.` (часто `app`) или Framework ≠ **Services**. `"next"` уже в корневом `package.json`. Не hostname `ibm-cargo.vercel.app`. Клики: [`plan-vercel-services.md`](./plan-vercel-services.md) §8. |
| `Build output contains no "functions" or "static"` | Framework = Other/Static (или чужой проект / Root ≠ `.`). Next не пишет эти папки. Prisma/allow-scripts warn не фатальны. Клики: [`plan-vercel-services.md`](./plan-vercel-services.md) §9. |

Не делать: коммитить секреты; fallback secret на **Production**; считать `ibm-cargo.vercel.app` продом LBM.

## 3. Структурирование

| Фаза | Что |
|------|-----|
| E1 | `bootAuthEnv()`: Preview origin из `VERCEL_BRANCH_URL` / `VERCEL_URL`; `AUTH_SECRET` → `NEXTAUTH_SECRET`; Preview-only derived secret если оба пусты |
| E2 | `authOptions.secret` + `pages.error=/login`; `proxy.ts` тот же secret |
| E3 | `/login` показывает Configuration / Callback по-русски |
| E4 | KB: Preview env must-have (зеркало Production) |
| E5 | `resolveSiteUrl()`: кандидаты без хоста `ibm-cargo.vercel.app`; пустой env → `http://localhost:3000` |
| E6 | `/login`: полные демо-email; `authorize` trim/lowercase + `client@` → `client@example.com`; hint при CredentialsSignin про seed/`DATABASE_URL` |
| E7 | `GET /health` `force-dynamic` + `databaseUrl: boolean`; `/login` баннер и disable submit, если `false` |

## 4. Реализация

Код: `src/lib/auth-env.ts`, `site-url.ts`, `db-url.ts`, `web-health.ts`, `auth-login.ts`, `prisma.ts` (lazy), `auth.ts`, `proxy.ts`, `app/health/route.ts`, `app/login/page.tsx`, `app/sitemap.ts`, `app/robots.ts`.  
Проверка: unit `auth-env` + `site-url` + `db-url` + `auth-login`; `GET /health` `databaseUrl`; локальный `signIn` demo.

## 5. Env на Vercel (человек, Dashboard)

Это **не баг Prisma-схемы**. `authorize()` читает пользователей из Postgres. Агент не может выставить секреты в Dashboard.

На **Preview** проекта [ibm-cargo](https://vercel.com/tikhonbaruchs-projects/ibm-cargo) (Production alias этого имени — чужой сайт, не копировать как origin):

1. **Settings → Environment Variables**
2. Найти `DATABASE_URL` (часто стоит только **Production**)
3. **Edit** → включить **Preview** (и Development, если нужно) → **Save**
4. Значение — тот же Postgres **`newlsu_lbm` с seed** (`client@example.com` / `demo1234`). Пароль БД **без** `#`. Если спецсимволы — URL-encode (`#` → `%23`).
5. Также Preview: `NEXTAUTH_SECRET` (не только `AUTH_SECRET`)
6. **Не** копировать `NEXTAUTH_URL=https://ibm-cargo.vercel.app` на Preview — код подставит branch URL
7. **Deployments → этот Preview → Redeploy** (без «Use existing Build Cache»), иначе runtime не увидит новую переменную

Проверка без логина: `GET /health` → `{ "ok": true, "service": "web", "databaseUrl": true }`.  
`databaseUrl: false` = переменной нет на этом деплое; `/login` покажет баннер и не будет звать Prisma.

Без seed вход даст CredentialsSignin; можно `/register`.

## 6. Деплой

Только Next/session. Merge не обязателен для проверки: Preview этого PR (SSO). Не открывать https://ibm-cargo.vercel.app как «наш прод».
