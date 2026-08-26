# Карта сред (as-is)

Куда крутить стек: локальный Next, Compose, Vercel.  
Команды: [`../development.md`](../development.md). Ops: [`runbook.md`](./runbook.md). Deploy: [`deploy.md`](./deploy.md).  
Preview/smoke: [`staging.md`](./staging.md). План: [`roadmap.md`](./roadmap.md).  
Контейнеры C1–C5: [`containerization.md`](./containerization.md).  
Что уже на prod: [`current-app.md`](./current-app.md) § «Интегрированные решения».

## Режимы

| Mode | Что запускается | Postgres | Domain API | Типичная цель |
|------|-----------------|----------|------------|---------------|
| **A** | Один Next (`npm run dev` :3000) | локальный / Compose `postgres` | Prisma в Next (`USE_DOMAIN_API` unset) | быстрая UI/domain разработка |
| **B** | Compose `core` / `scale` / `full` + surfaces | Compose `postgres` | `USE_DOMAIN_API=1` → `containers/api` | интеграция контейнеров, gateway |
| **Vercel** | Корневой Next (full surface) | внешний Postgres | **без** `USE_DOMAIN_API` (C1 dual) | прод UI (alias в Vercel) |

## Mode A — один Next

1. Секреты в **`app/.env`**: выделенная `DATABASE_URL` + `S3_*` (bucket `lbm`) + `NEXTAUTH_*`.
2. Опционально **`app/.env.local`**: только localhost UI / `ALLOW_MOCK_TOPUP` / mesh URLs — **не** переопределять `DATABASE_URL` / `S3_*` (см. `app/.env.local.example`).
3. `npx prisma db push` или `migrate deploy` (+ seed) против своей БД.
4. `npm run dev` → http://localhost:3000
5. Опционально stubs: `docker compose --profile core up -d` (project name **`lbm`** в `docker-compose.yml`).

Демо: `client@` / `broker@` / `operator@` / `admin@` (ADMIN) · `demo1234`.

Карта слоёв: [`docs/architecture-map.md`](../../../docs/architecture-map.md).

## Mode B — Compose

| Профиль | Сервисы |
|---------|---------|
| `core` | postgres, redis, api, ai, worker |
| `scale` | + payments, notify, llm (+ corpus volume `../llm/data/tnved/normalized`), logistics |
| `full` / `split` | + web/surfaces + gateway `:8080` |

Compose web defaults `USE_DOMAIN_API=1`. Gateway smoke: `npm run smoke:gateway`.

**БД в Compose:** сервисы `api` / `web` / `worker` используют фиксированный URL `postgres:5432` (не наследуют host `.env` `DATABASE_URL` на внешний Postgres). Host `.env` `DATABASE_URL` — только для Mode A (`npm run dev`) и миграций с хоста. Precedent write-back (`verified_determinations`) требует ту же БД, что и compose postgres.

**pgvector (precedent-v2):** образ `pgvector/pgvector:pg17`. После смены образа: `docker compose pull postgres && docker compose up -d postgres --force-recreate`, затем `npx prisma migrate deploy`. Без extension — fail-open, остаётся lexical `precedent-v1`. Миграция embeddings на sweb тоже fail-open (extension недоступен) · [`plan-tech-debt.md`](./plan-tech-debt.md) шаг 1 · [`database.md`](./database.md).

## Vercel (prod)

- Root = monolith Next; `postinstall` → `prisma generate` only
- Env: `DATABASE_URL`, `NEXTAUTH_*`, `NEXT_PUBLIC_SITE_URL`; mock topup via `ALLOW_MOCK_TOPUP`
- Uploads: `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` — без них `POST /api/v1/uploads` → **503** (FS read-only). **Заданы на Production и Preview** (as-of 2026-08-05). Для `<img src={mediaUrl}>` в кабинетах бакет должен отдавать объект публично **или** `S3_OBJECT_ACL=public-read` (если ACL включены).
- Signup: `/register` + `POST /api/v1/auth/register` (D25) — публичный путь в middleware
- **Не** ставить docker DNS / `USE_DOMAIN_API=1` на Vercel
- Миграции схемы — отдельно на prod DB (`db push` / migrate)
- Verify: `TEST_API_URL=https://taurus-liart.vercel.app npm run smoke:mvp` (+ `smoke:full`, `smoke:payments`)

Подробности: [`deploy.md`](./deploy.md) · результаты: [`staging.md`](./staging.md).

## Связанные флаги

| Env | Смысл |
|-----|--------|
| `USE_DOMAIN_API` | proxy session `/api/v1` → `containers/api` |
| `AI_SERVICE_URL` / `LLM_SERVICE_URL` | draft / enrich; **host** `.env` / `.env.local` → `http://127.0.0.1:4500`; **Compose** hardcodes `http://llm:4500` для ai/api/web (не подставлять host URL в контейнер) |
| `OCR_SERVICE_URL` | Qwen-VL describe в `AI_DRAIN` (+ extract); host `http://127.0.0.1:4700`; Compose `http://ocr:4700` |
| `POSTGRES_USER` / `PASSWORD` / `DB` | Compose volume as-is: default **`taurus`/`taurus`/`taurus`** (не `lbm` — старый default ломал api↔postgres). Host `.env` `DATABASE_URL` на sweb **не** прокидывается в api/web |
| `TNVED_CODES_PATH` | corpus mount в compose (`/data/tnved/codes.jsonl`) — только `containers/llm` |
| `PAYMENTS_SERVICE_URL` / `NOTIFY_SERVICE_URL` / `LOGISTICS_SERVICE_URL` | C4 opt-in |
| `S3_*` | durable VED uploads on Vercel (`BUCKET`/`ENDPOINT`/`REGION`/`ACCESS_KEY`/`SECRET_KEY`); optional `S3_OBJECT_ACL=public-read` for cabinet `<img>` |
| `NEXT_PUBLIC_SHIPPING_UI` / `SHIPPING_UI` | `1`/`true` = показать клиентский UI «Перевозка» (default **off**) |
| `NEXT_PUBLIC_FACTORY_UI` / `FACTORY_UI` | `1`/`true` = показать клиентский UI «Завод», manufacturer `/pools`, manufacturer/SKU helpers и admin nav «Производители» (default off в коде; **на Vercel Pro Production/Preview = `1`**) |
| `WEB_SURFACE` | `full` \| `slim` (C5 scaffold, D22) |
| `ALLOW_MOCK_TOPUP` | mock credit баланса (D13) |
| `LLM_TIMEOUT_MS` / `AI_TIMEOUT_MS` | classify/enrich / draft HTTP; default **30s / 35s** (раньше 3–4s — DeepSeek не успевал → heuristic) |

### Local mesh (optional compose in ibm-cargo)

1. Из `app/`: `docker compose --profile core up -d` (project name **`lbm`**).  
2. Postgres/API в сети compose (`lbm`).  
3. Mode A UI по-прежнему берёт **`DATABASE_URL` / `S3_*` из `app/.env`** (выделенная БД + bucket `lbm`). В `app/.env.local` можно указать только `AI/LLM/OCR_SERVICE_URL` на `127.0.0.1`, не подменяя БД/S3.  
4. Create: heuristic/precedent + `llmEnrichPending` → **быстрый 201** → `after()` гоняет AI_DRAIN (Qwen-VL ≤90s → DeepSeek ≤120s; `maxDuration=300`).  
   При фото: classify **ждёт** vision (requeue), см. [`plan-vision-before-classify.md`](./plan-vision-before-classify.md).
5. Кабинет poll GET ≤**120s** (create) + **пока открыта карточка** с `llmEnrichPending`; UI: фазы кнопки / баннер «Уточняем ТН ВЭД…» → «Код уточнён» ([`plan-smooth-create-path.md`](./plan-smooth-create-path.md)). Фото >~350KB — client JPEG compress перед upload.  
6. Gate: `ved.llmEnrichEnabled` (default on). Cron `jobs-tick` каждые **2 мин** — запасной путь.

### Vercel mesh (без docker URL)

На Production/Preview задать `LLM_PROVIDER=deepseek`, `DEEPSEEK_API_KEY` (+ optional `QWEN_API_KEY` / `QWEN_VISION_MODEL`).  
Next вызывает провайдеров напрямую (`src/lib/ved/provider-mesh.ts`): кандидаты из `TnvedCode` → DeepSeek; картинка → Qwen-VL.  
Не ставить `LLM_SERVICE_URL=http://llm:…` на Vercel. Create / ai-drain / jobs-tick: `maxDuration=300`.

Growth-провайдеры: [`growth.md`](./growth.md).


## AI chains (orch ↔ llm)

| Mode | How |
|------|-----|
| Vercel / Mode A | `AI_CHAIN_ID` + keys on Next (`chains/transport` → mesh) |
| Compose Mode B | `LLM_SERVICE_URL`/`OCR_SERVICE_URL` win → HTTP; same `AI_CHAIN_ID` |
| Chain 3 overlay | `docker compose -f docker-compose.yml -f docker-compose.chain-03.yml …` |

UI never calls matrix. Model ≠ container.  Orch facade: `describeForChain` / `classifyForChain`. Mode B OCR: `chainId` 3 → DeepSeek vision in `containers/ocr`. See [`plan-llm-orch-run-chain.md`](./plan-llm-orch-run-chain.md).
