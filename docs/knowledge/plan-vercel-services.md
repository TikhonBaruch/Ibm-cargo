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
| E6 empty `functions`/`static` | **done** — §9; prisma.config.ts + standalone gate; Dashboard Services |
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
| *no services declared* | Framework=Services, билдер **не видит** `services` (не тот root/commit) | Убирать блок `services` из json этой ветки. Разбор: **§10** |
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

## 9. Диагностика: «Build output contains no functions or static» (D33)

**Точная строка Vercel (это падение деплоя, не warning):**

```text
WARNING! Build output contains no "functions" or "static" directory; the build may not have produced any deployable output.
```

### Идея

Билдер **Other / Static** (`@vercel/static-build`) ищет корневые папки `functions/` или `static/`. Корневой Next `npm run build` пишет `.next/` (на Docker ещё `.next/standalone`). **Не** пишет `functions/` и `static/`. Static builder тогда предупреждает и выкладывает пустоту.

Это **не** чинится фейковыми пустыми `functions/` / `static/`, не `output: "export"` (сломает App Router / API / auth), не снятием блока `services` из `vercel.json`, не `"rootDirectory"` в json.

Соседние строки в том же логе — **не фатальны**:

| Строка | Смысл |
|--------|--------|
| `package.json#prisma is deprecated` | Prisma 6.19: seed перенесён в `prisma.config.ts` (`defineConfig` из `prisma/config`). Схему URL не трогаем (`env("DATABASE_URL")` в `prisma/schema.prisma`). Файл конфига сам читает `.env` / `prisma/.env` (CLI больше не грузит их). Prisma 7 не поднимаем. |
| `npm warn allow-scripts … not yet covered` | Advisory npm 11.16+. В `package.json` есть `allowScripts` (имя + pin из lockfile: Prisma 6.19.3, sharp **0.35.3**, tesseract.js 7.0.0, unrs-resolver 1.11.1). Лог с `sharp@0.34.5` = старый tree / другой деплой. Не `ignore-scripts`. |
| нет `functions` / `static` | **Фатально:** Framework = Other/Static, Root Directory ≠ `.`, или **чужой Vercel-проект**. |

### Анализ

| Симптом | Причина | Что не делать |
|---------|---------|----------------|
| нет `functions`/`static` | Framework Preset = **Other** (generic static), не **Services** и не `@vercel/next` | Класть пустые `functions/` / `static/`; `output: "export"` |
| Тот же текст при Root ≠ `.` | билдер смотрит не в корень (нет `vercel.json` `services`) | `"rootDirectory"` в `vercel.json` |
| Тот же текст на `ibm-cargo.vercel.app` | Production alias **другого** проекта (статический Uganda IBM Cargo) | Деплоить LBM туда |
| Prisma / allow-scripts warn + empty output | warn не убивают build; empty output — да | «чинить» warn снятием `services` |

`next.config.mjs`: `output: "standalone"` **только** вне Vercel cloud (`VERCEL` unset) или при `DOCKER_BUILD=1` (root `Dockerfile`, host-export в `containers/web`). На Vercel Next builder standalone не нужен и **не** создаёт `functions/`/`static/` — гейт сам по себе Other не лечит.

Агент **не** может выставить Dashboard Framework / Root Directory / env.

### Клики в Vercel Dashboard (человек)

Правильный проект: team **tikhonbaruchs-projects** / project **[ibm-cargo](https://vercel.com/tikhonbaruchs-projects/ibm-cargo)** (GitHub `TikhonBaruch/Ibm-cargo`). **Не** `https://ibm-cargo.vercel.app`.

1. [vercel.com](https://vercel.com) → team **tikhonbaruchs-projects** → project **ibm-cargo**.
2. **Settings** → **General** → **Framework Preset** → **Services** → **Save**.
3. **Root Directory** → **`.`** (пустое поле или `.`). Не `app` / `lint` / вложенная папка.
4. **Deployments** → коммит этой ветки → **Redeploy** (без stale cache).

После этого билдер должен быть **Services**: frontend `@vercel/next` + backend `Dockerfile.vercel`. В логе — Next compile, не generic static.

### Проверка

- Build log: нет empty `functions`/`static`; есть Next frontend + container `backend`.
- `npx prisma validate` / `npm run db:seed` читают `prisma.config.ts`, не `package.json#prisma`.
- `npm run test:ci` (гейт prisma.config + allowScripts + services).

## 10. Диагностика: «no services are declared» (D33)

**Точная ошибка Vercel:**

```text
Build Failed
Project framework is set to "services", but no services are declared. Add `services` to vercel.json with at least one service, or change the project framework setting.
```

### Идея

Dashboard **Framework Preset = Services** уже верный. Билдер читает `vercel.json` **только из Dashboard Root Directory**. Если в том каталоге нет ключа `services` (или файла нет) — эта ошибка за 0 ms, без Next compile.

На **этой** ветке (`cursor/ibm-cargo-vercel-root-ea2b`) корневой `vercel.json` **уже** содержит `services.frontend` + `services.backend` (канон `vercel.services.bff.json`). GitHub Preview этого PR на project [ibm-cargo](https://vercel.com/tikhonbaruchs-projects/ibm-cargo) с этим json **уже собирался Ready** (пример: deployment `51aJMpKJXZ3dXMSJZVMJZvxTqFR3`). Не убирать `services`. Не ставить `"rootDirectory"` в json. Не переключать Preset на Next.js / Other, пока json с `services`.

`https://ibm-cargo.vercel.app` — чужой статический проект; туда этот git не деплоить.

### Анализ

Vercel **не** «не видит» ключ из-за опечатки в этом PR. Он собрал **другое дерево**, чем корень этой ветки:

| Что собрали | Где лежит `vercel.json` | Root Directory | Результат |
|-------------|-------------------------|----------------|-----------|
| Эта ветка (Next в корне репо) | `./vercel.json` с `services` | `.` (пустое поле) | Ready: frontend Next + container backend |
| Эта ветка | нет файла в `app/` (`app/` = App Router) | `app` | **no services declared** |
| Production / branch `main` (ещё nested `app/` = пакет Next) | только `app/vercel.json` | `.` | **no services declared** (в корне `main` файла нет) |
| `main` | `app/vercel.json` с `services` | `app` | Services на **старой** вложенной вёрстке, не этот PR |
| Чужой проект / старый commit без `services` | нет блока | Services | **no services declared** |

Соседний лог `WARNING! Build output contains no "functions" or "static"` (§9) — тот же класс: билдер не вошёл в режим Services (нет `services` в прочитанном json) и упал в generic static.

Не чинить это `experimentalServices`, пустыми `functions/`, `output: "export"` или копией `vercel.json` в `app/` на этой ветке (`frontend.root: "."` тогда укажет на App Router без `"next"` → *No Next.js version detected*).

### Структурирование

| Фаза | Что |
|------|-----|
| E1 | Unit + `test:structure`: корневой `vercel.json` имеет `services`; **нет** `app/vercel.json` / `app/package.json` |
| E2 | KB: эта секция |
| E3 | Человек: клики ниже. Агент Dashboard не меняет |

### Клики в Vercel Dashboard (человек)

Проект: [ibm-cargo](https://vercel.com/tikhonbaruchs-projects/ibm-cargo) (комментарий Vercel на PR #4). **Не** сайт `ibm-cargo.vercel.app`.

1. **Settings** → **General** → **Framework Preset** = **Services** (уже). Не менять на Next.js.
2. **Root Directory** → **Edit** → **пусто** или **`.`**. Не `app`, не `lint`. **Save**.
3. **Не** Redeploy **Production** с ветки `main`, пока этот PR не влит: на `main` нет корневого `vercel.json`.
4. **Deployments** → деплой ветки `cursor/ibm-cargo-vercel-root-ea2b` (preview PR #4) → **Redeploy** без stale cache. Либо новый push в эту ветку.
5. Открывать Preview URL вида `ibm-cargo-git-cursor-ibm-cargo-ve-…vercel.app` (SSO), не production alias другого проекта.

После merge в `main` Production начнёт видеть корневой `vercel.json` с `services`. До merge Framework=Services + Redeploy Production = эта ошибка.

### Проверка

- Build log: нет *no services are declared*; есть сборка `frontend` (Next) и `backend` (`Dockerfile.vercel`).
- `npm run test:ci` (гейт корневого `services`, нет `app/vercel.json`).
