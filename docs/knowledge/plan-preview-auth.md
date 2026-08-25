# План: NextAuth «Server error» на Vercel Preview

Индекс: [`deploy.md`](./deploy.md) · [`environments.md`](./environments.md) · [`plan-vercel-services.md`](./plan-vercel-services.md).  
Ветвь 3 (ядро). D33.

## 1. Идея

На Preview (Visit Preview после SSO) `/login` или `/api/auth/*` отдаёт дефолтную страницу NextAuth:

> Server error  
> There is a problem with the server configuration.

Это **Configuration / NO_SECRET**, не баг формы. Проект Vercel `ibm-cargo` изначально был статическим IBM Cargo: Production alias `ibm-cargo.vercel.app` всё ещё тот сайт; Preview — этот Next. Env NextAuth/`DATABASE_URL` на Preview часто нет, либо задан только `AUTH_SECRET` (Auth.js), а код читает `NEXTAUTH_SECRET` (next-auth v4).

## 2. Анализ

| Симптом | Причина |
|---------|---------|
| HTML NextAuth «Server error» | Нет `NEXTAUTH_SECRET` в Node production |
| `AUTH_SECRET` есть, вход всё равно падает | v4 не читает `AUTH_SECRET` |
| `NEXTAUTH_URL=https://ibm-cargo.vercel.app` на Preview | CSRF/cookie на branch URL |
| После Configuration починен, «неверный пароль» | Нет `DATABASE_URL` → Prisma в `authorize` |

Не делать: коммитить секреты; fallback secret на **Production**.

## 3. Структурирование

| Фаза | Что |
|------|-----|
| E1 | `bootAuthEnv()`: Preview origin из `VERCEL_BRANCH_URL` / `VERCEL_URL`; `AUTH_SECRET` → `NEXTAUTH_SECRET`; Preview-only derived secret если оба пусты |
| E2 | `authOptions.secret` + `pages.error=/login`; `proxy.ts` тот же secret |
| E3 | `/login` показывает Configuration / Callback по-русски |
| E4 | KB: Preview env must-have (зеркало Production) |

## 4. Реализация

Код: `src/lib/auth-env.ts`, `site-url.ts`, `auth.ts`, `proxy.ts`, `app/login/page.tsx`.  
Проверка: unit `auth-env` + `site-url`; локальный `signIn` demo.

## 5. Env на Vercel (человек, Dashboard)

На **Preview и Production** проекта `ibm-cargo` (не только Production):

- `DATABASE_URL` — Postgres `newlsu_lbm` (URL-encode `#` → `%23`)
- `NEXTAUTH_SECRET` (длинный random; можно то же значение, что `AUTH_SECRET`)
- `NEXTAUTH_URL` — на Preview лучше **не** копировать prod origin; код подставит branch URL
- `NEXT_PUBLIC_SITE_URL`

Без `DATABASE_URL` NextAuth уже не покажет Configuration, но вход не найдёт демо-юзеров.

## 6. Деплой

Только Next/session. Merge не обязателен для проверки: Preview этого PR.
