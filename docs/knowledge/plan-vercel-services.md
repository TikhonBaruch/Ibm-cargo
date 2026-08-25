# План: Vercel Services — Next frontend + Docker backend

Индекс: [`deploy.md`](./deploy.md) · [`environments.md`](./environments.md) · [`plan-ui-auth-stubs.md`](./plan-ui-auth-stubs.md) · [`plan-preview-auth.md`](./plan-preview-auth.md).  
Ветвь 3. D33. **As-is этого репо:** `vercel.json` = Services BFF (канон [`vercel.services.bff.json`](../../vercel.services.bff.json)). Dashboard: **Root Directory = `.`**, **Framework = Services**. Hostname `ibm-cargo.vercel.app` — чужой проект, не прод LBM.

## 1. Идея

Один Vercel-проект: Next.js (UI + session BFF) + контейнер `Dockerfile.vercel` (`containers/api`).  
**Фаза BFF:** весь публичный HTTP → service `frontend` (Node routes + `proxy.ts` + `ved/proxy`).  
Service `backend` **собирается**, но в rewrites не участвует — доменный трафик идёт через BFF (`USE_DOMAIN_API=1` → `/api/bff` → Docker URL), не через Vercel rewrite на container.

## 2. Анализ

| As-is | Target фаза BFF | Target фаза domain-rewrite (hold) |
|-------|-----------------|-----------------------------------|
| Monolith Next + `app/api/v1` | Services: frontend gets all public paths | `/api/v1` → backend + path strip + cookie/JWT |
| `vercel.json` crons-only | `vercel.services.bff.json` → `vercel.json` | + rewrite `/api/v1` → backend |
| Compose api `:4000` `/v1/*` | `Dockerfile.vercel` + BFF headers | `authorize` accepts session |

## 3. Структурирование

### E1 — `Dockerfile.vercel` — **done**

### E2 — `vercel.json`

#### Prod (сейчас) — только crons

Файл `vercel.json` в корне — **не** трогать до §7:

```json
{
  "crons": [
    { "path": "/api/v1/internal/sla-tick", "schedule": "0 3 * * *" },
    { "path": "/api/v1/internal/jobs-tick", "schedule": "*/2 * * * *" }
  ]
}
```

#### Target BFF — канон для cutover

Источник истины: **[`vercel.services.bff.json`](../../vercel.services.bff.json)** (копировать в `vercel.json` в момент §7).

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "services": {
    "frontend": {
      "root": ".",
      "framework": "nextjs"
    },
    "backend": {
      "root": ".",
      "runtime": "container",
      "entrypoint": "Dockerfile.vercel"
    }
  },
  "rewrites": [
    { "source": "/api/auth/(.*)", "destination": { "service": "frontend" } },
    { "source": "/api/admin/(.*)", "destination": { "service": "frontend" } },
    { "source": "/api/bff/(.*)", "destination": { "service": "frontend" } },
    { "source": "/api/v1/(.*)", "destination": { "service": "frontend" } },
    { "source": "/api/(.*)", "destination": { "service": "frontend" } },
    { "source": "/(.*)", "destination": { "service": "frontend" } }
  ],
  "crons": [
    { "path": "/api/v1/internal/sla-tick", "schedule": "0 3 * * *" },
    { "path": "/api/v1/internal/jobs-tick", "schedule": "*/2 * * * *" }
  ]
}
```

`backend.root` обязателен (иначе Vercel валидация падает за 0 ms). Публичный трафик всё равно только на `frontend`.

Почему всё на `frontend`: NextAuth, CMS admin API, BFF (`/api/bff`, `/api/v1`) и UI живут в Node. Docker получает вызовы только server-side из `src/lib/ved/proxy.ts` (заголовки `x-internal-key` / `x-user-id` / `x-user-role`).  
`backend` в `services` нужен, чтобы образ из `Dockerfile.vercel` собирался в том же deployment (готов к binding / следующему этапу).

### E3 — Node proxy + BFF — **done**

| Артефакт | Роль |
|----------|------|
| `proxy.ts` (root) | Node UI redirects; rewrite `/api/v1/*` → `/api/bff/*` при `USE_DOMAIN_API=1` |
| ~~`middleware.ts`~~ | **removed** |
| `src/lib/ved/proxy.ts` | BFF session → domain headers; 502+log |
| `app/api/bff/[...path]` | rewrite target |
| `app/api/v1/[...path]` | catch-all |
| `vercel.services.bff.json` | frozen cutover config |

Stay-on-Next: `auth/*`, `uploads`, `imports/*`, `internal/jobs-tick`.

### Hold (после §7)

- Wire `USE_DOMAIN_API=1` в Dashboard (Production/Preview); `DOMAIN_API_URL` — **не** руками: binding `frontend`→`backend` в `vercel.json` (`env: DOMAIN_API_URL`)
- Backend env: тот же `DATABASE_URL`, `INTERNAL_API_KEY` (= frontend)
- Vercel rewrite `/api/v1` → container + JWT в `authorize()` — later
- Не слать `/api/(.*)` целиком в Docker с браузера

## 4. Реализация

| Фаза | Статус |
|------|--------|
| План + target BFF template | **done** |
| E1 Dockerfile | **done** |
| E2 prod crons-only | **done** |
| E3 Node proxy + BFF | **done** |
| E4 `vercel.services.bff.json` + runbook §7 | **done** |
| Framework Services + activate json | **done** — этот репо: `vercel.json` = BFF services; Dashboard Root=`.` |
| E5 «No Next.js version detected» | **done** — §8; гейт `vercel-root` / `test:structure` |
| Domain rewrite / JWT | hold |

## 5. Проверка (после cutover)

- Deploy Ready на **Preview** Vercel-проекта `ibm-cargo` (GitHub `TikhonBaruch/Ibm-cargo`). **Не** `https://ibm-cargo.vercel.app` — это другой Vercel-проект.
- `/` и `/health` → 200 
- Login NextAuth (`/api/auth/*`)  
- `/api/v1/me` с сессией  
- Crons paths без изменения  
- В build log: **нет** `Edge Function output "middleware"`  
- Есть build container `backend` (Dockerfile.vercel)

## 6. Деплой (повседневный)

Этот репозиторий: Framework = **Services** + блок `services` в `vercel.json`. Не переключать Preset на Next.js, пока json с `services`. Root Directory всегда `.`. Исторический crons-only cutover — §7 (не откатывать json).

## 7. Cutover runbook — Vercel Dashboard (минимум даунтайма)

**Инвариант:** Framework=Services ⇔ в деплое есть блок `services` в `vercel.json`.  
Иначе: *no services declared* или *framework is nextjs / services mismatch*.  
Текущий **Ready** Production alias **не** падает в момент Save Framework — ломается только **следующий** build.

### Preflight (до переключения Framework)

1. На Production уже задеплоен код с **`proxy.ts`**, без `middleware.ts` (иначе Services → Edge error).  
   Если ещё нет — сначала merge/deploy при Framework=**Next.js** и crons-only `vercel.json`, дождаться Ready, проверить `/` + login.
2. Env на Production: `NEXTAUTH_SECRET`, `DATABASE_URL`, `CRON_SECRET`; для BFF→Docker позже: `USE_DOMAIN_API`, `DOMAIN_API_URL` / `API_SERVICE_URL`, `INTERNAL_API_KEY` (можно добавить после первого Services deploy, если backend пока idle).
3. Подготовить коммит cutover:  
   `cp vercel.services.bff.json vercel.json`  
   (не пушить, пока не готов шаг B).

### A — Dashboard: Framework → Services

1. [Vercel](https://vercel.com) → project **ibm-cargo** → **Settings** → **General**.  
2. **Framework Preset** → **Services** → **Save**.  
3. **Не** жать Redeploy старого deployment с crons-only — он упадёт.  
4. Старый успешный deploy остаётся живым до следующего build. Hostname `ibm-cargo.vercel.app` при этом **не** наш прод.

### B — Первый деплой с новым `vercel.json` (сразу после Save)

1. В репо: заменить `vercel.json` содержимым `vercel.services.bff.json`, commit, push в `main` (или Deploy из CLI: `vercel deploy --prod` из дерева с новым json).  
2. Дождаться **Ready** (frontend Next + container backend).  
3. Проверить preview URL при необходимости, затем Production alias.  
4. Smoke: login, `/api/v1/me`, `/health`.

### C — Rollback (если build Error)

1. Settings → Framework Preset → **Next.js** → Save.  
2. Восстановить crons-only `vercel.json` (как в §3 E2 prod), push.  
3. Дождаться Ready — alias снова на монолит.

### Запрещено

- Framework=Services + `vercel.json` без `services`.  
- Framework=Next.js + `vercel.json` с `services`.  
- Redeploy старого commit без `services` после переключения Framework.  
- Возврат Edge `middleware.ts`.
- `"rootDirectory"` в `vercel.json` (Vercel отклоняет: Root Directory только в Dashboard).
- Dashboard **Root Directory** = `app` / `lint` / любая папка без корневого `package.json` с `"next"`.

## 8. Диагностика: «No Next.js version detected» (D33)

**Точная ошибка Vercel:**

```text
Warning: Could not identify Next.js version, ensure it is defined as a project dependency.
Error: No Next.js version detected. Make sure your package.json has "next" in either "dependencies" or "devDependencies". Also check your Root Directory setting matches the directory of your package.json file.
```

### Идея

Билдер `@vercel/next` читает `package.json` из **Dashboard Root Directory**. Если там нет `"next"` — эта ошибка. В этом репозитории Next живёт в **корне**: `package.json` → `"next": "16.1.6"`, App Router в `app/`, domain в `src/`, схема в `prisma/`. Папка `app/` — это роуты Next, **не** отдельный пакет.

Ошибка **не** значит, что `"next"` пропал из зависимостей. Она значит: проект смотрит не в корень репо (часто Root Directory = `app`, `lint` или Framework Preset = **Next.js** вместо **Services** при блоке `services` в `vercel.json`).

`https://ibm-cargo.vercel.app` к этой ошибке не относится: это Production alias **другого** Vercel-проекта (статический IBM Cargo). Этот git деплоится как project **ibm-cargo** → Preview URL (SSO). Канон LBM: https://taurus-liart.vercel.app.

Dashboard **нельзя** выставить из агента / `vercel.json` (`rootDirectory` — invalid key).

### Анализ

| Симптом | Причина | Что не делать |
|---------|---------|----------------|
| *No Next.js version detected* | Root Directory = `app` (или другая папка без `"next"`) | Класть `package.json` в `app/` — сломает пути (`app/app`, нет `next.config` / `src` / `prisma`) |
| Тот же текст при Framework=Next.js | Preset Next.js + `vercel.json` `services` / неверный root | Ставить `"framework": "nextjs"` **на корне** `vercel.json` — перебьёт Services |
| *no services declared* | Framework=Services, в json нет `services` | Убирать блок `services` |
| *project-configuration* / unknown `rootDirectory` | `"rootDirectory"` в `vercel.json` | Повторять коммит `9ce7f7f` |

Код-сторона (уже в репо): `services.frontend.root` = `"."`, `framework` = `"nextjs"`, `backend` = `Dockerfile.vercel`. Это относительно Dashboard Root Directory: при Root = `.` билдер видит корневой `package.json` с `"next"`.

### Структурирование

| Фаза | Что |
|------|-----|
| E1 | Unit + `test:structure`: root `"next"`, нет `app/package.json`, нет `rootDirectory`, frontend.root=`.` |
| E2 | KB: эта ошибка = Dashboard Root Directory `.` + Framework=Services |
| E3 | Человек: клики ниже → Redeploy текущего коммита ветки |

### Клики в Vercel Dashboard (человек)

Проект: [ibm-cargo](https://vercel.com/tikhonbaruchs-projects/ibm-cargo) (тот, что в комментарии Vercel на PR, **не** сайт `ibm-cargo.vercel.app`).

1. [vercel.com](https://vercel.com) → team **tikhonbaruchs-projects** → project **ibm-cargo**.
2. **Settings** → **General**:
   - **Framework Preset** → **Services** → **Save**.
     (Не Next.js: при блоке `services` Preset должен быть Services.)
3. **Settings** → **Build and Deployment** (тот же блок есть и в General):
   - **Root Directory** → **Edit** → корень репозитория: поле **пустое** или **`.`**.  
     Не выбирать `app`, `lint`, `src`, `containers`, `llm`.
   - **Save**.
4. **Deployments** → открыть последний коммит этой ветки → **Redeploy** (без «Use existing Build Cache», если сомнение). Не редеплоить старый Error с Root=`app`.

После Save Root Directory следующий git push / Redeploy должен найти `"next": "16.1.6"` в корневом `package.json`.

### Проверка

- Build log: нет *No Next.js version detected*; есть Next frontend + container `backend`.
- Preview URL вида `ibm-cargo-git-…-tikhonbaruchs-projects.vercel.app`, не `https://ibm-cargo.vercel.app`.
- `npm run test:ci` (гейт root/services).
