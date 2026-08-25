# Runbook: local / Compose / Vercel+sweb

Операционный гид. Деньги: баланс + ЮKassa TOPUP (D13). LLM/precedent compose/local: [`ai-pipeline.md`](./ai-pipeline.md) · [`plan-precedent-bulk.md`](./plan-precedent-bulk.md).  
Карта режимов сред (as-is): [`environments.md`](./environments.md).  
Preview / результаты prod smoke: [`staging.md`](./staging.md). План: [`roadmap.md`](./roadmap.md).

## Local (Next + sweb DB)

1. `.env` / `.env.local`: `DATABASE_URL` (sweb), `NEXTAUTH_*`, optional `S3_*`, optional `PAYMENTS_SERVICE_URL`.
2. `npx prisma db push` · `npm run db:seed` (тарифы, demo client/broker/admin, баланс demo-клиента).
3. `npm run dev` → http://localhost:3000  
4. Mock topup: без `PAYMENTS_SERVICE_URL` в non-prod **или** `ALLOW_MOCK_TOPUP=1` (не включать на prod без stub/payments).
5. MVP signup: `/register` → `POST /api/v1/auth/register` (Company + User CLIENT, balance 0); broker только seed/admin.

## MVP bootstrap checklist

| Step | Command / URL |
|------|----------------|
| Schema + seed | `npm run db:push` && `npm run db:seed` |
| Auth | `NEXTAUTH_URL`, `NEXTAUTH_SECRET` |
| Stub money | no `PAYMENTS_SERVICE_URL` locally, or Compose payments + `ALLOW_MOCK_TOPUP=1` on demo |
| Vercel media | `S3_*` → VED uploads durable (`/api/v1/uploads`); optional `S3_OBJECT_ACL=public-read` so `CalculationItem.mediaUrl` works in `<img>` |
| Compose local media | volume `ved_uploads` → `public/uploads/ved`; entrypoint `containers/web/docker-entrypoint.sh` chown; serve via `app/uploads/ved/[filename]/route.ts` (`GET /uploads/ved/*`) |
| Compose LLM enrich | profile `scale`/`full`: service `llm` :4500; mount `./containers/llm/data/tnved/normalized:/data/tnved:ro`; `LLM_SERVICE_URL=http://llm:4500`; gate `llmEnrichEnabled` |
| Compose DB (Mode B) | `api`/`web`/`worker` → **in-network** `postgresql://lbm:lbm@postgres:5432/lbm` (host `.env` `DATABASE_URL` на sweb **не** подставляется — нужно для `verified_determinations` write-back) |
| Precedent smoke | `npm run smoke:precedent-csv` после `smoke:chain-llm` (локальный postgres) |
| Client shipping UI | off by default; `NEXT_PUBLIC_SHIPPING_UI=1` to show «Перевозка» |
| Factory / manufacturer helpers | Vercel Pro: `NEXT_PUBLIC_FACTORY_UI=1` (Production+Preview). Local default off. Shows client «Завод», manufacturer `/pools`, SKU helpers, admin «Производители» |
| Jobs tick (Pro cron) | `*/15 * * * *` → `/api/v1/internal/jobs-tick` (SLA + outbox drain + AI_DRAIN claim). **`CRON_SECRET` must be set** — Vercel only sends Bearer when it exists; `NEXTAUTH_SECRET` alone is not enough for Cron. AI overlay only if `OCR_SERVICE_URL` / `LLM_SERVICE_URL` set |
| Verify | `npm run smoke:payments` · `npm run smoke:full` · `npm run smoke:mvp` |

## Compose scale (api + payments + notify)

```bash
npm run docker:scale   # or profile scale/full
```

Env (`docker.env` / `.env`):

| Variable | Role |
|----------|------|
| `DATABASE_URL` | Postgres (compose postgres or sweb) |
| `PAYMENTS_SERVICE_URL` | `http://payments:4300` (web/api) |
| `WEBHOOK_TARGET` | `http://api:4000/v1/webhooks/payments` |
| `INTERNAL_API_KEY` | Shared secret for worker / smoke (`x-internal-key`); local default `dev-secret-change-me` · must match app |
| `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY` | Real acquiring |
| `YOOKASSA_RETURN_URL` | `/cabinet/balance?topup=1` |
| `NOTIFY_SERVICE_URL` | `http://notify:4400` |
| `RESEND_API_KEY` or `SMTP_URL` | Real email (**required for prod client mail**; see notify README) |
| `SMTP_FROM` | Verified from-address for Resend/SMTP |
| `NOTIFY_OPS_EMAIL` | SLA alerts recipient |
| `ALLOW_MOCK_TOPUP` | `0` on stage/prod |
| `ALLOW_FORCE_CONFIRM` | `0` on prod (YooKassa only via webhook) |
| `S3_OBJECT_ACL` | Optional `public-read` so cabinet `<img mediaUrl>` works |

Stub checkout (no YooKassa keys): auto TOPUP webhook.  
With keys + method `card`/`sbp`: pending → confirmUrl → YooKassa webhook (verified via payment GET + Basic).

### Gateway smoke (C5 gate)

Requires Docker Compose (`npm run docker:full` or profile with `gateway`).

**Ubuntu (эта машина):** один раз с паролем sudo:

```bash
sudo bash scripts/setup-docker-ubuntu.sh
newgrp docker   # or re-login / `sg docker -c '…'`
# Override host .env if it points at sweb — compose must use service DNS `postgres`:
DATABASE_URL='postgresql://lbm:lbm@postgres:5432/lbm?schema=public' \
NEXTAUTH_URL=http://localhost:8080 NEXT_PUBLIC_SITE_URL=http://localhost:8080 \
  npm run docker:full
DATABASE_URL='postgresql://lbm:lbm@localhost:5432/lbm?schema=public' npx prisma db push
DATABASE_URL='postgresql://lbm:lbm@localhost:5432/lbm?schema=public' npx prisma db seed
TEST_API_URL=http://localhost:8080 NEXTAUTH_URL=http://localhost:8080 npm run smoke:gateway
```

> **Ребренд local slug (`lbm`):** после смены `POSTGRES_USER`/`POSTGRES_DB` с `lbm` на `lbm` нужен `docker compose down -v` и заново `db push` + `db seed` — старый volume хранит role `lbm`.

Local **PASS 2026-08-07**. Prisma `binaryTargets` includes `linux-musl-openssl-3.0.x` for Alpine images.  
If Docker Hub / npm-in-build timeouts: host-build Next standalone into `containers/*/.export/` (gitignored), then `docker compose build`. Root `next.config.mjs` emits standalone unless `VERCEL` is set; force with `DOCKER_BUILD=1 npm run build` (root `Dockerfile` sets this). Optional: `docker-compose.build-host.yml` (`build.network: host`).

Without Docker CLI, skip and keep checklist in [`dual-path-parity.md`](./dual-path-parity.md). Rootless install also needs `uidmap` via sudo.

### Payments host (P1b / ЮKassa)

1. Deploy `containers/payments` with `YOOKASSA_SHOP_ID` + `YOOKASSA_SECRET_KEY`.
2. Set `PAYMENTS_SERVICE_URL` on web/api; `WEBHOOK_TARGET` → Next or domain api `/api/v1/webhooks/payments`.
3. Prod: `ALLOW_MOCK_TOPUP=0`; client uses method `card`/`sbp`.
4. Verify: `npm run smoke:payments` against that host.

### Shipping UI go-live

`NEXT_PUBLIC_SHIPPING_UI=1` (+ optional `LOGISTICS_SERVICE_URL`). Default remains off (D27).

### OCR (P2)

Compose: `OCR_SERVICE_URL=http://ocr:4700` (profile scale/full). Create merges OCR attrs when item has `mediaUrl`.  
Engines: text PDF (`ocr-pdf-text-v1` / `ocr-pdf-table-v1`), vision (`ocr-vision-v1` — **`imageBase64`**, не PDF), else stub.  
Import: client PDF → local unpdf → optional `POST /v1/extract-table`. Smoke: `npm run smoke:pdf-import`.  
**Vision hold:** ключ `OPENAI_API_KEY` + `OCR_VISION_MODEL` на `ocr`; wire UI/domain — [`plan-ocr-vision.md`](./plan-ocr-vision.md).  
Local: `node containers/ocr/src/index.js` → `curl :4700/health` + extract.

## Vercel + sweb

- `DATABASE_URL` → внешний Postgres (`sslmode=require`).
- After D26 commit: `npx prisma migrate deploy` (or `db push`) for `service_orchestration` (+ support ownership if missing).
- S3_* → Yandex Object Storage; set `S3_OBJECT_ACL=public-read` (or public bucket) for thumbs.
- **Do not** set `USE_DOMAIN_API` until C5 cutover (D22).
- For acquiring: host `containers/payments` somewhere reachable; set `PAYMENTS_SERVICE_URL` + `WEBHOOK_TARGET` pointing at Next `https://…/api/v1/webhooks/payments` **or** domain api.
- Production: mock topup disabled unless `ALLOW_MOCK_TOPUP=1`.
- Ship status: push to `origin` may need local SSH/`gh auth`; migrate + smoke on sweb/Vercel after push.

## Health checks

- DB: Prisma `SELECT 1` / app login.
- S3: HeadBucket / put-delete probe.
- Web: `GET :3000/health` (Compose healthcheck).
- Gateway: `GET :8080/health` + `npm run smoke:gateway`.
- Payments: `GET :4300/health`.
- Notify: `GET :4400/health`.
- OCR: `GET :4700/health` (also gateway `/api/ocr/health`).
- Orchestration (D26): `GET /api/v1/internal/orch/health` with `x-internal-key` (or domain api `/v1/internal/orch/health`). Probes payments/llm/ai/notify/logistics/**ocr** (Next ↔ api parity). `200` if deps up + call failure rate OK; `503` if dep down / failure spike / outbox backlog.

## Smoke money path

```bash
npm run smoke:payments   # topup stub/mock → balance↑
npm run smoke:full       # seed client: create→pay→claim→approve (retry/timeout на flaky Vercel)
npm run smoke:chain-llm  # compose/local: upload GET + create w/ llmEnrich + pay→broker→PDF
npm run smoke:precedent-csv  # precedent-v1 + CSV preview (local postgres)
npm run smoke:csv-import     # CSV preview → create
npm run smoke:pdf-import     # text-layer PDF → preview
npm run smoke:reclassify     # broker LLM reclassify (compose)
npm run smoke:precedent-vector  # pgvector precedent-v2 (needs OPENAI_API_KEY)
npm run smoke:mvp        # register→topup→create→pay→claim→approve (D25)
# Prod:
TEST_API_URL=https://ibm-cargo.vercel.app npm run smoke:mvp
TEST_API_URL=https://ibm-cargo.vercel.app npm run smoke:full
```

`smoke:mvp`: upload optional если host отвечает 503 «S3 not configured». Актуальные результаты — [`staging.md`](./staging.md).

## Track A ops (notify / ЮKassa)

```bash
npm run ops:track-a -- --vercel          # presence of RESEND / PAYMENTS / YOOKASSA env names
# A2: vercel env add RESEND_API_KEY production → redeploy → approve → inbox
# A1: host payments + YOOKASSA_* → PAYMENTS_SERVICE_URL → then ALLOW_MOCK_TOPUP=0 on prod only
```

F17: without `RESEND_API_KEY` / `NOTIFY_SERVICE_URL` outbox drain **fails** (no fake DELIVERED).  
A1: keep `ALLOW_MOCK_TOPUP` on prod until live ЮKassa smoke passes ([`plan-track-a-p0.md`](./plan-track-a-p0.md)).

## C5 gate

Keep `smoke:gateway` green before slim cutover ADR. Cabinets stay on root Next until then.  
**Do not** set `WEB_SURFACE=slim` or `NEXT_PUBLIC_SHIPPING_UI=1` on prod as MVP CTA (D27).
