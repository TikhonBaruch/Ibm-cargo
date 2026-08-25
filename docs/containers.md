# Контейнеры

Корень: [`containers/`](../containers/README.md)  
Orchestration: [`docker-compose.yml`](../docker-compose.yml)  
Env-шаблон: [`docker.env.example`](../docker.env.example)  
Ответвления extract: [`knowledge/containerization.md`](./knowledge/containerization.md) (C1–C5, ADR D19).

## Карта

| Сервис | Папка | Порт | Профили | Health |
|--------|-------|------|---------|--------|
| `postgres` | `containers/postgres` | 5432 | core, web, scale, full | `pg_isready` |
| `redis` | `containers/redis` | 6379 | core, web, scale, full | `redis-cli ping` |
| `api` | `containers/api` | 4000 | core, web, scale, full | `GET /health` (domain claim/approve) |
| `ai` | `containers/ai` | 4100 | core, web, scale, full | `GET /health` |
| `worker` | `containers/worker` | 4200 | core, web, scale, full | `GET /health` (SLA_TICK → web) |
| `payments` | `containers/payments` | 4300 | scale, full | `GET /health` |
| `notify` | `containers/notify` | 4400 | scale, full | `GET /health` |
| `llm` | `containers/llm` | 4500 | scale, full | `GET /health` (Classification/Duty stub) |
| `logistics` | `containers/logistics` | 4600 | scale, full | `GET /health` (3PL stub) |
| `ocr` | `containers/ocr` | 4700 | scale, full | `GET /health` (extract stub; create fail-open) |
| `web` | `containers/web` | 3000 | web, full | `GET /health` |
| `admin` | `containers/admin` | 3001 | split, full | `GET /health` |
| `broker` | `containers/broker` | 3002 | split, full | `GET /health` (Next app, D16) |
| `client` | `containers/client` | 3003 | split, full | `GET /health` (Next app, D17) |
| `manufacturer` | `containers/manufacturer` | 3004 | split, full | `GET /health` (Next app, D31) |
| `gateway` | `containers/gateway` | 8080 | full | `GET /health` |

Сеть Docker: `lbm`. DNS-имена = имена сервисов (`api`, `ai`, `worker`, …).

## Связи (env)

```text
web      → DATABASE_URL → postgres | external
web      → API / AI / WORKER / PAYMENTS / NOTIFY / LLM / LOGISTICS / OCR / REDIS
worker   → REDIS_URL, API_SERVICE_URL, AI_SERVICE_URL
payments → WEBHOOK_TARGET → api
ai       → optional LLM_SERVICE_URL
api      → optional LOGISTICS_SERVICE_URL, AI, NOTIFY, OCR
admin|broker|client → WEB_ORIGIN, API_SERVICE_URL
broker   → WEB_API_ORIGIN (API rewrite), NEXTAUTH_*
worker   → REDIS_URL, API_SERVICE_URL, WEB_SERVICE_URL, INTERNAL_API_KEY (SLA_TICK)
api      → DATABASE_URL, INTERNAL_API_KEY (domain claim/approve)
gateway  → все UI + api + ai + worker + payments + notify + llm + logistics + ocr
```

## Профили

```bash
npm run docker:core    # postgres + redis + api + ai + worker
npm run docker:web     # + web
npm run docker:split   # admin + broker + client Next
npm run docker:scale   # + payments + notify + llm + logistics
npm run docker:full    # всё + gateway :8080
npm run docker:down
```

## Gateway

[`containers/gateway/nginx.conf`](../containers/gateway/nginx.conf):

| Location | Upstream |
|----------|----------|
| `/` | `web:3000` |
| `/admin-app/` | `admin:3001` |
| `/broker-app/` | `broker:3002` |
| `/manufacturer-app/` | `manufacturer:3004` |
| `/api/domain/` | `api:4000` |
| `/api/v1/ai/` | `ai:4100` |
| `/api/worker/` | `worker:4200` |
| `/api/payments/` | `payments:4300` |
| `/api/notify/` | `notify:4400` |
| `/api/llm/` | `llm:4500` |
| `/api/logistics/` | `logistics:4600` |
| `/api/ocr/` | `ocr:4700` |
| `/health` | gateway liveness |

## Ownership

| Зона | Каталоги | Контейнер |
|------|----------|-----------|
| Web / landing | `app/`, `src/components/landing` | `web` |
| Client cabinet | `app/cabinet`, `containers/client` | `client` + routes в `web` |
| Manufacturer cabinet | `app/manufacturer`, `containers/manufacturer` | `manufacturer` + routes в `web` |
| Admin | `app/admin`, `containers/admin` | `admin` + routes в `web` |
| Broker | `app/broker`, `containers/broker` | `broker` + routes в `web` |
| Domain API | `containers/api` | `api` |
| AI draft | `containers/ai` | `ai` |
| Jobs | `containers/worker` | `worker` |
| Acquiring | `containers/payments` | `payments` |
| Notifications | `containers/notify` | `notify` |
| LLM stub | `containers/llm` | `llm` |
| Logistics stub | `containers/logistics` | `logistics` |
| Infra | `gateway`, `postgres`, `redis` | `gateway`, `postgres`, `redis` |

## Группы (as-is)

- **Infra:** postgres, redis, gateway  
- **Ядро (ветвь 3):** api, ai, worker  
- **Growth (C4):** payments, notify, llm, logistics  
- **UI:** web, admin, broker, client, manufacturer  
- **Growth (C4):** payments, notify, llm, logistics, **ocr** (vision compose)  

Прод Vercel = корневой Next (`/cabinet`, `/broker`, `/admin`) до C5 cutover — не отдельный compose-сервис.

## Предполагаемое будущее и приоритеты

Кандидаты без папок / усиление существующих. Полная матрица P1a/P1b–P3 и антипаттерны: [`containers/README.md`](../containers/README.md) §«Что добавлять». D19 — не дробить infra. Сверка **D27**: logistics/LLM/ЮKassa = P1b Growth, не текущий polish.

| Приоритет | Действие |
|-----------|----------|
| **P1a** (D27/polish) | `notify` email, `worker` orch/ledger, admin orch UI, `api` tnved/settings, heuristic `ai`, C5 web-slim |
| **P1b** (Growth) | `llm` enrich, `logistics` 3PL + shipping flag, `payments` ЮKassa |
| **P2** | OCR vision E2E + UI (service `ocr` already compose live; hold keys/UI) |
| **P3** | По триггеру: observability, pdf, media sidecar, AI Risk, Redis job broker |

| Кандидат | Предпочтительный путь | Приоритет |
|----------|----------------------|-----------|
| notify email / sms-push | расширение `notify` | P1a |
| admin orch UI | pane в `admin` | P1a |
| tnved catalog search | расширение `api` | P1a |
| support inbox | `api` + `admin` UI | P1a |
| web-slim | режим `web` | P1a |
| llm enrich | `llm` | P1b |
| logistics 3PL | `logistics` | P1b |
| payments ЮKassa | `payments` | P1b |
| ocr / docs-ingest | **новый** сервис | P2 |
| Redis job broker | `redis` + `worker` | P3 |
| PDF / documents | сервис или worker | P3 |
| media / uploads | sidecar или Next/S3 | P3 |
| observability | sidecar; orch/health уже есть | P3 |
| realtime chat | sidecar к `api` | P3 |

> На машине без Docker CLI конфиги валидны; stubs можно поднять через `node containers/<svc>/src/index.js`.
