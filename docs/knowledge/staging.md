# Staging и preview

Индекс сред: [`environments.md`](./environments.md). Деплой: [`deploy.md`](./deploy.md). План: [`roadmap.md`](./roadmap.md).  
Инвентарь решений: [`current-app.md`](./current-app.md). Signup ADR: **D25**.

## Рекомендуемая схема

| Среда | Назначение | Как |
|-------|------------|-----|
| **Local** | ежедневная разработка | Mode A: `.env` → `prisma db push` → `npm run dev` ([`environments.md`](./environments.md)) |
| **Preview** | PR / ветка перед prod | Vercel Preview Deployment |
| **Prod** | пользователи | https://ibm-cargo.vercel.app |

Отдельный долгоживущий staging-стенд **не обязателен**, если каждый PR получает Vercel Preview. Осторожно: общая preview-БД = prod sweb → smoke пишет тестовые регистрации/топапы.

## Vercel Preview

1. Push ветки → Vercel создаёт preview URL (`https://ibm-cargo-*-*.vercel.app`).
2. Env: **зеркало Production** — как минимум `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (origin preview!), `NEXT_PUBLIC_SITE_URL`, `ALLOW_MOCK_TOPUP`, полный набор `S3_*` (`BUCKET`, `ENDPOINT`, `REGION`, `ACCESS_KEY`, `SECRET_KEY`).
3. Smoke:

```bash
TEST_API_URL=https://your-preview.vercel.app npm run smoke:mvp
TEST_API_URL=https://your-preview.vercel.app npm run smoke:payments
TEST_API_URL=https://your-preview.vercel.app npm run smoke:full
```

4. `NEXTAUTH_URL` на preview должен совпадать с origin preview-деплоя (не копировать prod URL вслепую).

## Prod smoke (после merge в `main`)

```bash
TEST_API_URL=https://ibm-cargo.vercel.app npm run smoke:mvp
TEST_API_URL=https://ibm-cargo.vercel.app npm run smoke:payments
TEST_API_URL=https://ibm-cargo.vercel.app npm run smoke:full
```

Требования prod:

- schema актуальна на sweb (`prisma migrate deploy` / `db push` при drift; пример 2026-08-20: `manufacturer_proposal`);
- post-ship 2026-08-20: prod `smoke:mvp` ×2 PASS; Vercel project `manufacturer` unlinked (ignore build); AI_DRAIN live = Compose only;
- `ALLOW_MOCK_TOPUP=1` для demo topup без внешнего payments host;
- `S3_*` для durable upload (без них `POST /api/v1/uploads` → 503; `smoke:mvp` продолжает create без `mediaUrl`);
- API routes с Prisma на build — `export const dynamic = "force-dynamic"` (пример: `/api/promos`), иначе Vercel build падает без `DATABASE_URL` на prerender.

Smoke-скрипты (`smoke:full` / `smoke:mvp`): retry + backoff + timeout ~45s — Vercel иногда рвёт длинные сессии (`terminated` / `fetch failed`).
`smoke:chain-llm`: принимает `storage: local|s3`; после create **poll** `llmEnrichPending` ≤2 мин (как кабинет). UX/upload: [`plan-smooth-create-path.md`](./plan-smooth-create-path.md).
Online probes цепочки: `npm run probe:ai-chain` → `tmp/chain-probes-*.jsonl` · `GET /api/v1/calculations/:id/chain-log` · [`plan-chain-run-log.md`](./plan-chain-run-log.md).

### Результаты smoke (prod)

| Дата | Smoke | Результат | Заметки |
|------|-------|-----------|---------|
| 2026-08-23 | deploy `b24b01c` + rich probe | **PASS** #47931 | ThinkPad X1 full attrs (CN, Lenovo, specs) → `8471 30 000 0` conf 0.95; `chain-log` + `chainRun` live; classify mesh ~1.3s |
| 2026-08-23 | `probe:ai-chain` ×4 | **PASS** #47927–#47930 | laptop→8471 30; tee→6109 10; laptop+png→8471 30; shoes→6404 11; all `llm-openai-v1` ~8–22s; `chain-log` API after deploy |
| 2026-08-23 | `smoke:mvp` | **PASS** #47924 DONE | 1-й прогон `terminated` после login; retry OK; S3 tiny upload OK |
| 2026-08-23 | AI_DRAIN Mode A | **PASS** #47926 | create pending → poll → `8471 30 000 0` `llm-openai-v1` `chainId: 3` |
| 2026-08-21 | `smoke:mvp` | **PASS** (#47888); 2-й прогон #47889 DONE (хвост fetch flaky) | Vercel direct DeepSeek: `AI_DRAIN` **DONE**, ServiceCall `llm/classify` **OK** `llm-openai-v1` (~3.6s); Qwen soft-fail на tiny smoke PNG; `ved.llmEnrichEnabled`; Tnved leaves ~13k |
| 2026-08-21 | AI-контур accuracy | **PASS** #47891 `6109 10 000 0` (хлопковая футболка); #47890 до фикса ложно `6403*` («повседневной носки») | `fd0fed3` hint-first + no force `candidates[0]`; create HTTP иногда ETIMEDOUT при длинном drain — в БД/GET код уже верный |
| 2026-08-21 | wait≤2m AI_DRAIN | **PASS** #47892 create 8.5s `pending` → poll → `6109 10 000 0` `llm-openai-v1` (~14s total) | `431de34` after()+cabinet poll; без обрыва HTTP |
| 2026-08-21 | `smoke:payments` | **PASS** | mock +1500 |
| 2026-08-05 (до merge register) | `smoke:mvp` | FAIL | `/register` 404, `POST …/auth/register` → **401** (deploy drift / middleware) |
| 2026-08-05 (до merge register) | `smoke:payments` | PASS / flaky | mock topup; иногда network timeout |
| 2026-08-05 (после merge `cursor/gap-providers-c5` → `main` + S3 env) | `smoke:mvp` | **PASS** | register → topup → **S3 upload** → create → pay → claim → DONE |
| 2026-08-05 | `smoke:payments` | **PASS** | balance↑ mock topup |
| 2026-08-05 | `smoke:full` | **PASS** | seed client spine; retries на broker/PDF при flaky fetch |
| 2026-08-06 | `smoke:mvp` | **PASS** | after D26 db push + migrate resolve; S3 upload OK |
| 2026-08-06 | `smoke:full` | **PASS** | #47822 → DONE |
| 2026-08-07 | `smoke:mvp` | **PASS** | #47828 → DONE (autoAssign IN_REVIEW); smoke retries hardened |
| 2026-08-07 | `smoke:full` | **PASS** | #47830 → DONE + PDF 1141 chars |
| 2026-08-07 | `smoke:payments` | **PASS** | mock topup +1500 (`provider=mock`) |
| 2026-08-07 (Track A plan) | `smoke:mvp` | **PASS** | #47831 → DONE (autoAssign) |
| 2026-08-07 (Track A plan) | `smoke:full` | **PASS** | #47832 → DONE + PDF 1141 chars |
| 2026-08-07 (Track A plan) | `smoke:payments` | **PASS** | mock +1500 (flaky fetch retries) |
| 2026-08-12 (post-merge PR #1) | `smoke:mvp` | **PASS** | #47855 → DONE (autoAssign; approve retry) |
| 2026-08-12 (post-merge PR #1) | `smoke:full` | **PASS** | #47856 → DONE + PDF 1140 chars |
| 2026-08-12 | `smoke:payments` | **PASS** | mock +1500 (1-й прогон flaky `terminated`; retry OK) |
| 2026-08-12 | `smoke:full` | **PASS** | #47852 → DONE + PDF 1141 chars (broker-login retry) |
| 2026-08-12 | `smoke:broker` | **PASS** | #SEED-READY → DONE mapping + PDF 1205 (1-й прогон `fetch failed`) |
| 2026-08-12 | `smoke:chat` | **PASS** | #47824 messages 4 (1-й прогон `fetch failed`) |
| 2026-08-12 | `smoke:shipping` | **PASS** | pre-DONE → 400 OK |
| 2026-08-12 | `smoke:client` | FAIL / drift | ожидает `QUEUED`; на prod `autoAssign` → `IN_REVIEW` после pay |
| 2026-08-13 | `smoke:sla` @ local `:3010` | **PASS** | middleware пропускает `/api/v1/internal/*`; `INTERNAL_API_KEY=dev-secret-change-me` |
| 2026-08-12 | `ops:track-a -- --vercel` | NEED | RESEND / PAYMENTS_SERVICE_URL / YOOKASSA (D27 holds OK) |
| 2026-08-13 | light prod check `4ec404e` | **PASS** | Vercel Ready; LBM brand; list/get omit `pdfHtml`; DONE `hasPdf`; demo `admin@`/`operator@` → ADMIN (sweb role drift fixed) |
| 2026-08-13 | review checkpoint `0ed9725` | **PASS** | Production Ready; auth matrix CLIENT/BROKER/ADMIN×2; calc list 43 w/o pdfHtml (~112KB); GET hasPdf; queue empty OK; Track A still NEED RESEND/ЮKassa |
| 2026-08-13 | `ops:track-a -- --vercel` | NEED | A2 RESEND / A1 ЮKassa still NEED; D27 holds OK |

Повторять после каждого merge, затрагивающего auth / uploads / pay / schema.

### Track A ops keys (prod) — статус 2026-08-07

| Шаг | Env / host | Статус |
|-----|------------|--------|
| A2 notify | `SMTP_FROM` on Vercel | set |
| A2 notify | `RESEND_API_KEY` или `SMTP_URL` | **нужен** (оператор) — без ключа drain = FAILED; `npm run ops:track-a -- --vercel` |
| A1 payments | `PAYMENTS_SERVICE_URL` + ЮKassa keys + webhook | **не на prod** — demo = mock (`ALLOW_MOCK_TOPUP`) |
| A1 mock gate | `ALLOW_MOCK_TOPUP` off на prod после live | **ещё mock** (smoke payments подтверждает) |

Ключи **не** выставляются из репо/агента — только Vercel dashboard / private ops. Checklist: [`plan-track-a-p0.md`](./plan-track-a-p0.md).

Preview/Production env: `S3_OBJECT_ACL=public-read`, `SMTP_FROM` (для inline Resend нужен ещё `RESEND_API_KEY` в Vercel).

## Визуальный чеклист C ↔ B ↔ A (Preview / prod)

Цель: руками проверить взаимодействие **Клиент → Брокер → Админ** на Vercel после деплоя ветки `cursor/admin-ops-harden` (пакет кабинетов).  
**Preview:** Vercel Preview of `TikhonBaruch/Ibm-cargo` (PR on current branch).  

**Доступ:** на Preview включён Vercel Deployment Protection (`ssoProtection: all_except_custom_domains`). Открывать через кнопку **Visit Preview** в PR / Vercel dashboard (SSO под аккаунтом TikhonBaruch). Прямой curl без SSO уходит на `vercel.com/login`. Prod custom domain (`ibm-cargo.vercel.app`) от SSO свободен.  
Канон техдолга: [`plan-tech-debt.md`](./plan-tech-debt.md). Демо: `client@example.com` / `broker@example.com` / `admin@example.com` / `operator@example.com` · `demo1234` (оба ADMIN; SUPER obscure).

### Подготовка

1. Preview URL из PR / Vercel dashboard (или prod после merge).
2. Schema на sweb актуальна (`verified_determinations` — шаг 1 tech-debt **done**).
3. `ALLOW_MOCK_TOPUP=1`, `S3_*` заданы (upload без S3 → 503, create без media всё ещё ок).

### A. Клиент (`/cabinet`)

| # | Действие | Ожидание |
|---|----------|----------|
| C1 | Login client → дашборд | Заявки / баланс / nav без «Перевозка» |
| C2 | Новая заявка: описание ± фото → создать | `AI_READY`, код HS heuristic |
| C3 | (опц.) CSV/XLSX в new → превью → подставить | строки в форму, лимит тарифа D10 |
| C4 | Topup mock → Pay | баланс↓, статус `QUEUED` или Express `DONE` |
| C5 | Открыть заявку | статусы, события, PDF после DONE |
| C6 | Поддержка: тред → сообщение | thread в inbox; deep-link `?threadId=` |
| C7 | Профиль / settings | поля компании сохраняются |

### B. Брокер (`/broker`)

| # | Действие | Ожидание |
|---|----------|----------|
| B1 | Login broker → Очередь | заявка клиента (если QUEUED) |
| B2 | Claim | `IN_REVIEW`, чат заявки |
| B3 | Mapping: HS / duty / VAT / fee → сохранить | реальные item id, не synthetic |
| B4 | Чат с клиентом | сообщения с обеих сторон |
| B5 | Approve | `DONE` + PDF; клиент видит в карточке |
| B6 | (опц.) Escalate own IN_REVIEW | `SLA_RISK` |
| B7 | Unread badge | счётчик на nav при waitingOn=BROKER |

### C. Админ (`/admin`)

| # | Действие | Ожидание |
|---|----------|----------|
| A1 | Login admin → клиенты | drill-down компании, ledger |
| A2 | ADJUSTMENT ± сумма + reason | баланс компании меняется |
| A3 | Bookings `?id=` заявки | детали + PDF link после DONE |
| A4 | Support inbox | тред клиента; ответ staff |
| A5 | Settings toggles | marketplace / acceptingJobs / maintenance (осторожно на shared DB) |
| A6 | `/admin/tnved` import | batch кодов (не полный dump) |
| A7 | Orch / integrations | health cards; retry FAILED/DEAD если есть |
| A8 | Users create/reset | без SUPER в списках |

### Сквозной happy-path (минимум)

```text
C2 create → C4 pay → B2 claim → B3 map → B5 approve
  → C5 PDF у клиента
  → A3 admin видит ту же заявку
  → C6↔A4 support round-trip
```

После прохождения — отметить в таблице smoke ниже или в PR description.

## Compose как integration staging

```bash
cp docker.env.example .env
# если в .env DATABASE_URL = remote (sweb) — для локального compose явно:
DATABASE_URL='postgresql://lbm:lbm@postgres:5432/lbm?schema=public' \
NEXTAUTH_URL=http://localhost:8080 NEXT_PUBLIC_SITE_URL=http://localhost:8080 \
  npm run docker:full
# seed в compose Postgres (не в sweb):
DATABASE_URL='postgresql://lbm:lbm@localhost:5432/lbm?schema=public' npx prisma db push
DATABASE_URL='postgresql://lbm:lbm@localhost:5432/lbm?schema=public' npx prisma db seed
TEST_API_URL=http://localhost:8080 NEXTAUTH_URL=http://localhost:8080 npm run smoke:gateway
```

Последний локальный PASS: **2026-08-07** (`/api/v1/me`, `/cabinet`, `/client-app/`).  
Не заменяет Vercel preview для UI monolith, но закрывает C1–C4 + gateway.
