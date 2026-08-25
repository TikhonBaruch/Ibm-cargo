# План: Vercel Services — Next frontend + Docker backend

Индекс: [`deploy.md`](./deploy.md) · [`environments.md`](./environments.md) · [`plan-ui-auth-stubs.md`](./plan-ui-auth-stubs.md).  
Ветвь 3. D33. **Cutover:** см. §7. Рабочий `vercel.json` = crons-only, пока Framework = Next.js.

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
| Framework Services + activate json | **done** — Ready `fb8a5bc` (backend.root fix); alias live |
| Domain rewrite / JWT | hold |

## 5. Проверка (после cutover)

- Deploy Ready, alias `taurus-liart.vercel.app`
- `/` и `/health` → 200  
- Login NextAuth (`/api/auth/*`)  
- `/api/v1/me` с сессией  
- Crons paths без изменения  
- В build log: **нет** `Edge Function output "middleware"`  
- Есть build container `backend` (Dockerfile.vercel)

## 6. Деплой (повседневный)

Пока Framework = **Next.js**: только crons `vercel.json`.  
Cutover — строго по §7.

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

1. [Vercel](https://vercel.com) → project **taurus** → **Settings** → **General**.  
2. **Framework Preset** → **Services** → **Save**.  
3. **Не** жать Redeploy старого deployment с crons-only — он упадёт.  
4. Production alias пока отдаёт **последний успешный** Next.js deploy — сайт жив.

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
