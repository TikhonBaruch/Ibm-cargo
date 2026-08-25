# containers/

Каждый контейнер — отдельная папка. Orchestration: корневой [`docker-compose.yml`](../docker-compose.yml).

Карта ответвлений: [`docs/knowledge/containerization.md`](../docs/knowledge/containerization.md) · полный инвентарь: [`docs/containers.md`](../docs/containers.md).

## As-is (14 + ocr)

| Группа | Папка | Сервис | Порт | Назначение |
|--------|-------|--------|------|------------|
| UI | [`web/`](./web/) | `web` | 3000 | Next full (Vercel); slim scaffold **C5**; `GET /health` |
| UI | [`admin/`](./admin/) | `admin` | 3001 | Next VED-админка (**D20**/D28) |
| UI | [`broker/`](./broker/) | `broker` | 3002 | Next кабинет брокера (**D16**) |
| UI | [`manufacturer/`](./manufacturer/) | `manufacturer` | 3004 | Next кабинет производителя (**D31**) |
| Ядро | [`api/`](./api/) | `api` | 4000 | Domain API **C1** (session-proxy via Next) |
| Ядро | [`ai/`](./ai/) | `ai` | 4100 | AI draft **C3** (heuristic-v1) |
| Ядро | [`worker/`](./worker/) | `worker` | 4200 | SLA_TICK / OUTBOX_DRAIN / BackgroundJob (D26) |
| Growth | [`payments/`](./payments/) | `payments` | 4300 | Эквайринг **C4** (webhook TOPUP) |
| Growth | [`notify/`](./notify/) | `notify` | 4400 | Notify **C4** |
| Growth | [`llm/`](./llm/) | `llm` | 4500 | Classification/Duty — **LBM-owned** (D36; no nested `./llm` sync) |
| Growth | [`logistics/`](./logistics/) | `logistics` | 4600 | 3PL quotes/tracking stub |
| Growth | [`ocr/`](./ocr/) | `ocr` | 4700 | OCR — **LBM-owned** (D36); create fail-open |
| Infra | [`redis/`](./redis/) | `redis` | 6379 | Очередь / кэш (jobs пока в Postgres, D26) |
| Infra | [`gateway/`](./gateway/) | `gateway` | 8080 | Nginx (`/health`, `/api/ocr/`, …) |
| Infra | [`postgres/`](./postgres/) | `postgres` | 5432 | Init scripts локальной БД |

**Не контейнер, но прод-surface:** корневой Next на Vercel (`/cabinet`, `/broker`, `/admin`) — dual с extract UI до C5 cutover.

**ServiceCall (D26):** журналируются вызовы `api` / `ai` / `llm` / `payments` / `notify` / `logistics` / `worker`. UI-контейнеры своих таблиц не получают.

**AI / D36:** `containers/{llm,ocr}` — LBM-owned. Внешняя матрица (taurus / nested `./llm`) — **только HTTP** (`*_SERVICE_URL`); `sync:ai-matrix` retired. **Model ≠ container** — [`docs/knowledge/plan-parallel-ownership.md`](../docs/knowledge/plan-parallel-ownership.md) · [`plan-zero-llm-coupling.md`](../docs/knowledge/plan-zero-llm-coupling.md).

## Что добавлять (рекомендации ВЭД/B2B SaaS)

Сначала **глубина** существующих 14, потом **один** новый extract. Не плодить UI/инфра-ветки (D19).  
Канон также: [`docs/containers.md`](../docs/containers.md), [`docs/knowledge/containerization.md`](../docs/knowledge/containerization.md).  
Сверка с фокусом MVP (**D27** / [`product.md`](../docs/knowledge/product.md)): сейчас deliverable = ТН ВЭД → брокер-QC → PDF; logistics / LLM / ЮKassa — **не** текущий CTA ([`plan-mvp-polish.md`](../docs/knowledge/plan-mvp-polish.md)).

### Не добавлять (антипаттерны)

| Кандидат | Почему нет |
|----------|------------|
| Ещё UI-контейнеры сверх client/broker/admin/manufacturer/web | Extract кабинетов уже есть; dual до C5. **D31** — исключение: отдельная продуктовая ветвь производителя |
| Дробление postgres/redis/gateway | ADR D19 |
| Отдельный support-сервис | inbox = `api` + pane в `admin` |
| Отдельный tnved на старте | search/import в `api` + D24 |
| Отдельный sms/push | каналы в `notify` (D26 outbox) |
| realtime/WS «ради тренда» | polling chat до нагрузки |
| Redis job broker «ради Redis» | Postgres `BackgroundJob` (D26) пока ок |

### P1 — усилить существующие (не новые папки)

**P1a — совместимо с D27 / polish (делать сейчас):**

1. **`notify`** — email prod (Resend/SMTP); SMS/push поверх outbox позже (`channel` уже в D26).
2. **`worker`** — kinds: orch canary / ledger reconcile (без logistics track, пока shipping off).
3. **`admin` UI** — Jobs/Outbox/ServiceCall read-only (`orch/health`).
4. **`api`** — TN VED search/import UX; enforcement settings (`acceptingJobs`, marketplace).
5. **`ai`** — качество **heuristic** draft (не LLM-контейнер); attrs/confidence под D27.
6. **C5 `web` slim** — режим после стабильного dual UI (не блокер polish).

**P1b — Growth (после снятия блокеров D27):**

7. **`llm`** — enrich classify (fail-open); не новый AI-контейнер на каждый vision-модуль.
8. **`logistics`** — реальный 3PL за `/v1/quotes`; shipping UI flag когда готово.
9. **`payments`** — ЮKassa/СБП в проде.
10. **`worker`** — logistics track poll (когда есть 3PL).

**P2 — OCR (scaffold + fail-open wire):**

**`ocr` / `docs-ingest`** (`containers/ocr`, порт `4700`) — stub `POST /v1/extract`; contract `d-ocr.ai.json`; Compose `scale`/`full`; create uses `OCR_SERVICE_URL` fail-open; gateway `/api/ocr/`.

### P3 — позже (нагрузка / комплаенс)

| Сервис | Триггер |
|--------|---------|
| observability (OTel / Prometheus) | несколько хостов, SLA ops |
| pdf / documents | HTML→PDF блокирует approve или нужен архив |
| media / uploads sidecar | virus-scan, CDN, большой трафик |
| AI Risk | регуляторные требования (модуль в `ai` или read-сервис) |
| AI Documents | внутри `ocr`+`ai`, не третий контейнер сразу |
| Redis job broker | объём/latency Postgres SKIP LOCKED |

### Кандидаты без папок (сводка)

| Кандидат | Путь | Приоритет |
|----------|------|-----------|
| notify email prod | расширение `notify` | P1a |
| admin orch UI | pane в `admin` | P1a |
| tnved search / settings | `api` | P1a |
| support inbox | `api` + `admin` | P1a |
| heuristic AI quality | `ai` | P1a |
| web-slim | режим `web` | P1a |
| sms / push | `notify` channels | P1a → later |
| llm enrich | `llm` | P1b (Growth) |
| logistics 3PL | `logistics` | P1b (Growth) |
| payments ЮKassa | `payments` | P1b (Growth) |
| **ocr / docs-ingest** | **новый контейнер** | **P2** |
| Redis job broker | `redis` + `worker` | P3 |
| observability | sidecar stack | P3 |
| pdf / documents | сервис или worker | P3 |
| media / uploads | sidecar или Next/S3 | P3 |
| realtime / chat WS | sidecar к `api` | P3 |

**Итог:** добавлять возможности в существующие сервисы (P1a сейчас; P1b после D27); один новый extract — **`containers/ocr`** (P2); observability/pdf/media — по триггеру (P3). Не раздувать inventory без контракта и dual-path writers.

Внутренние DNS-имена в сети `lbm` = имя сервиса (`http://api:4000`).

Документация: [`docs/containers.md`](../docs/containers.md).  
Диалоги ядра: [`docs/knowledge/core-dialogues.md`](../docs/knowledge/core-dialogues.md).  
Контракты: [`docs/contracts/`](../docs/contracts/).
