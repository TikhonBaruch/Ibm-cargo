# Staging и preview

Индекс сред: [`environments.md`](./environments.md). Деплой: [`deploy.md`](./deploy.md). План: [`roadmap.md`](./roadmap.md).  
Инвентарь решений: [`current-app.md`](./current-app.md). Signup ADR: **D25**.

## Рекомендуемая схема

| Среда | Назначение | Как |
|-------|------------|-----|
| **Local** | ежедневная разработка | Mode A: `.env` → `prisma db push` → `npm run dev` ([`environments.md`](./environments.md)) |
| **Backup ядра (D37)** | https://taurus-liart.vercel.app — **read-only, не трогать** | [`plan-taurus-backup-core.md`](./plan-taurus-backup-core.md) |
| **Preview (активный)** | PR / ветка | Vercel Preview проекта `ibm-cargo` |
| **Prod (целевой)** | VPS + Compose / свой домен | Vercel — временный |
| **Этот репозиторий** | PR Preview | Vercel project `ibm-cargo` (не hostname `ibm-cargo.vercel.app`) |

Отдельный долгоживущий staging-стенд **не обязателен**, если каждый PR получает Vercel Preview. Осторожно: общая preview-БД = prod sweb → smoke пишет тестовые регистрации/топапы.

## Vercel Preview

**C32 DevEx:** полный чеклист Visit Preview + mock topup + SSO bypass — [`plan-c32-preview-devex.md`](./plan-c32-preview-devex.md).

1. Push ветки → Vercel создаёт preview URL (`https://ibm-cargo-*-*.vercel.app`).
2. Env: **зеркало** ключей — как минимум `DATABASE_URL` на **Preview** (часто переменная висит только на Production) → seeded Postgres `newlsu_lbm` (`client@example.com` / `demo1234`; пароль БД без `#`). Клики: [`plan-preview-auth.md`](./plan-preview-auth.md) §5. Проверка: `GET /health` → `databaseUrl: true`. Также `NEXTAUTH_SECRET`, не копировать `NEXTAUTH_URL=https://ibm-cargo.vercel.app`, `NEXT_PUBLIC_SITE_URL`, `ALLOW_MOCK_TOPUP`, `S3_*`. Без seed вход даст «неверный пароль»; можно `/register`.
3. Доступ: **Visit Preview** (SSO) **или** `VERCEL_AUTOMATION_BYPASS_SECRET` + header `x-vercel-protection-bypass` (C32b). Без этого curl/агент → `vercel.com/sso-api`.
4. Smoke: при выключенном mock topup `smoke:mvp` падает на seeded `client@example.com` (баланс ≥ 1000 ₽). Полный signup→topup: `ALLOW_MOCK_TOPUP=1` + `mockTopupAllowed` в admin.

```bash
# доступность без записи в БД (SSO → exit 1; bypass/open → OK)
TEST_API_URL=https://your-preview.vercel.app npm run probe:preview

TEST_API_URL=https://your-preview.vercel.app npm run smoke:mvp
TEST_API_URL=https://your-preview.vercel.app npm run smoke:payments
TEST_API_URL=https://your-preview.vercel.app npm run smoke:full
# spine bundle (mvp → payments → client → broker → full):
TEST_API_URL=https://your-preview.vercel.app npm run smoke:standalone
# с bypass (секрет только в env / CI, не в git):
VERCEL_AUTOMATION_BYPASS_SECRET=… TEST_API_URL=https://your-preview.vercel.app npm run smoke:standalone
```

5. `NEXTAUTH_URL` на preview должен совпадать с origin preview-деплоя (не копировать prod URL вслепую).
6. Если build: *No Next.js version detected* — Settings Root Directory = `.`, Framework = **Services**; `"next"` уже в корневом `package.json`. Не открывать `https://ibm-cargo.vercel.app`. Канон: [`plan-vercel-services.md`](./plan-vercel-services.md) §8.
7. Если build: *Build output contains no "functions" or "static" directory* — тот же Dashboard: Framework **Services**, Root `.`, проект **ibm-cargo** (не alias `ibm-cargo.vercel.app`). Prisma/allow-scripts warn в том же логе не фатальны. Канон: [`plan-vercel-services.md`](./plan-vercel-services.md) §9.

## Prod smoke (после merge в `main`)

```bash
TEST_API_URL=<preview-url> npm run smoke:standalone
# or individual:
TEST_API_URL=<preview-url> npm run smoke:mvp
```

Не использовать `https://ibm-cargo.vercel.app` — это другой проект.

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
| 2026-08-31 | **P6 hint precision** search `огурец` | **PASS** | top `0707*` / `0711*` / `2001*`; attr-suggest clarify-only = unit P4 (prod post-merge) · [`plan-hint-chains-precision-audit.md`](./plan-hint-chains-precision-audit.md) |
| 2026-08-29 | prod `/health` ibm-cargo-phi | **OK** | `databaseUrl: true` (reachability; не C32c) |
| 2026-08-25 | **go-live merge** M2+M0+D36 → `main` | **done** | [`plan-go-live-mvp.md`](./plan-go-live-mvp.md) |
| 2026-08-25 | post-merge prod smoke | **PASS** | mvp #47937 · full #47938 · client · broker · payments |
| 2026-08-25 | `smoke:standalone` (prod spine bundle) | **PASS** | mvp → payments → client #47932 → broker #47807 → full #47940 |
| 2026-08-25 | **main merge** M2+M0+D36 | **done** | #6→#7→#8 → main; nested `llm/` removed · [`plan-full-split-ibm-cargo.md`](./plan-full-split-ibm-cargo.md) |
| 2026-08-25 | `smoke:mvp` (post full split) | **PASS** #47936 DONE | after `git rm -r llm/`; CI 508 PASS |
| 2026-08-25 | `smoke:mvp` | **PASS** #47934 DONE | register → mock topup → **S3** upload → create → pay → **IN_REVIEW** (autoAssign) → approve; M0.1 mock+S3 OK |
| 2026-08-25 | `smoke:payments` | **PASS** | mock +1500 (`provider=mock`) |
| 2026-08-25 | **M0.2 visual C↔B↔A** (prod taurus) | **PASS** | client dash/new/brokers/balance/support/profile; broker dash/queue/work/chat; admin dash (группы nav) /bookings/support/settings; без 500; shipping UI off |
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

### P6 — hint-chains precision (NewCalc + search) · 2026-08-31

Канон: [`plan-hint-chains-precision-audit.md`](./plan-hint-chains-precision-audit.md) P4–P6.

| # | Проверка | Ожидание | Результат |
|---|----------|----------|-----------|
| H1 | Unit `test:hint-precision` | 100% golden packs | **PASS** (P1 #38) |
| H2 | Unit produce fork apply | 0707 / 0711 / 2001 chips | **PASS** unit (P2 #39) |
| H3 | Unit cascade маринад/корнишоны | 2001 / 0711 | **PASS** unit (P3 #40) |
| H4 | Unit attr-suggest «огурец» | clarify-only + hsHint 0707, не 61 | **PASS** unit (этот PR P4) |
| H5 | Live search prod `q=огурец` | top codes глава **07** / **20**, не 61/04 | **PASS** 2026-08-31 `ibm-cargo-phi`: `0707000500` Огурцы · `0711400000` · `2001100000` |
| H6 | Live attr-suggest prod «огурец» | clarify-only notes + 0707 (после merge P4) | **pre-deploy:** silent generic (ожидаемо до merge); **post-merge:** повторить probe |
| H7 | Manual NewCalc `/cabinet/new` | chips «Овощи: в каком виде?» → свежий/рассол/консервы | **чеклист** (SSO Visit Preview / prod demo) |

```bash
# post-merge P4 probe (session cookie)
# POST /api/v1/calculations/attr-suggest { "name":"огурец" }
# → notes clarify-only, attrs.hsHint ~ 0707
# GET /api/v1/tnved/search?q=огурец → 07xx / 20xx first
```

### Cov — hint coverage expansion (P7–P12) · 2026-09-01

Канон: [`plan-hint-coverage-expansion.md`](./plan-hint-coverage-expansion.md). **78 packs** после merge стека #50–#56.  
Прогон: [`plan-hint-gap-probe-run.md`](./plan-hint-gap-probe-run.md) (G0–G6).  
Offline pre-flight: `npx vitest run src/lib/ved/__tests__/hint-coverage-p12.test.ts` · `npm run probe:hint-gap -- --live` · `npm run probe:hint-gap:full`.

| # | Проверка | Ожидание | Результат |
|---|----------|----------|-----------|
| H1 | Unit `hint-coverage-p7…p12` + `test:hint-precision` | 0 NEW STEAL · pack matrix green | **PASS** unit (stack #50–#56) |
| H2 | Unit cascade Cov-P11/P12 golden | рис→10 · рыба→03 · SSD→84 · playstation→95 | **PASS** unit |
| H3 | Gap probe `--fail-on steal,misroute` | 0 STEAL / 0 MISROUTE on dictionary | **PASS** offline |
| H3b | Gap probe `--full` observe | household pack-hit **92.7%** · any-help **100%** · miss **0** (after P19) | **PASS** offline 2026-09-01 |
| H4 | POLICY bare stays null | провод/камера/фильтр/свеча/перец/кот | **PASS** unit |
| H5 | Live search prod (post-merge) | `q=рис`→10xx · `q=рыба`→03xx · `q=SSD`→84xx · `q=playstation`→95xx | **чеклист** post-merge |
| H6 | Live attr-suggest prod | рис/колбаса/чайник → clarify-only + `clarifyPack`; носки→6115; куртка→6201 | **чеклист** post-merge (auth cookie) |
| H7 | Manual NewCalc `/cabinet/new` | chips: рис→grains · колбаса→meat · SSD→pc-parts · playstation→gaming · лимонад≠fruit | **чеклист** (SSO Visit Preview / prod demo) |

**Live subset (dictionary `live: true`):** огурец · молоко · кеды · ноутбук · кепка · рис · колбаса · рыба · водка · чайник · SSD · фотоаппарат · моторное масло · ручка · гитара · сигареты · playstation · носки · **+P13–P17:** ореховое молоко · пицца · галстук · полка · лампа · микрофон · steam deck · свечи зажигания · лыжи · морс.

```bash
# offline
npm run test:hint-coverage
npm run probe:hint-gap -- --live --format table
npm run probe:hint-gap -- --fail-on steal,misroute
npm run probe:hint-gap:full

# post-merge live (session cookie / SSO Visit Preview) — DEFER until deploy
# POST /api/v1/calculations/attr-suggest { "description":"рис" }
#   → clarifyPack=grains-pasta
# GET /api/v1/tnved/search?q=рыба → 03xx first
# /cabinet/new → type «playstation» → gaming chips, not toys
```

**Miss-log triage (closed):** лимонад≠fruit · кофемашина≠tea-coffee · автокресло≠furniture · порошок→cleaning · сок≠fruit · e-cig≠tobacco · playstation≠toys · инвалидная коляска≠baby-gear · food+apparel+elec+auto+sport (P14–P16) · hangers/mask/bowl/toilet paper (P19).  
**Residual POLICY (not bugs):** bare провод/камера/фильтр/свеча/перец · кот/собака · plant «рисовое молоко» · переходник/кабель/шланг · труба/арматура.  
**Residual MISS:** **0** (plan-s7 after P19).

Повторять H5–H7 после human merge стека coverage → main → **deploy** prod/preview.

### Cov — P13–P17 residual + P18 offline closeout · 2026-09-01

Канон: [`plan-hint-gap-probe-run.md`](./plan-hint-gap-probe-run.md) §6.6 · PRs **#58–#62** merged into stack. **Deploy не выполнялся** — G5 live ниже = чеклист для оператора.

| # | Проверка | Ожидание | Результат |
|---|----------|----------|-----------|
| H1 | Unit `hint-coverage-p13…p18` + `test:hint-precision` | 0 STEAL · golden **95/95** | **PASS** offline |
| H2 | Cascade S+ P17 rows | морс→2202 · варежки→6116 · HDD→8471 · hdmi→8544 · фильтры→8421 | **PASS** unit |
| H3 | Golden `--fail-on steal,misroute` | 0 STEAL / 0 MISROUTE | **PASS** offline |
| H3b | Full observe plan-s7 | pack **92.7%** · any **100%** · miss **0** | **PASS** offline (P19) |
| H4 | POLICY bare | переходник · кабель · шланг · труба · арматура + legacy | **PASS** unit |
| H5 | Live search (post-deploy) | см. таблицу ниже | **DEFER** |
| H6 | Live attr-suggest (post-deploy) | см. таблицу ниже | **DEFER** |
| H7 | Manual NewCalc chips (post-deploy) | см. таблицу ниже | **DEFER** |

**H5 live search (post-deploy checklist):**

| Query | Ожидание top prefix |
|-------|---------------------|
| `пицца` | 19xx prepared |
| `морс` | 2202 (не snacks) |
| `микрофон` | 8518 |
| `лыжи` | 9506 |
| `ореховое молоко` | ≠ 0401 milk |

**H6 live attr-suggest (post-deploy):**

| Query | Ожидание |
|-------|----------|
| `галстук` | A+ ~6215 |
| `полка` | clarifyPack=bedroom-furniture |
| `свечи зажигания` | clarifyPack=auto-parts |
| `steam deck` | clarifyPack=gaming |

**H7 NewCalc chips (post-deploy):**

| Query | Chip pack | mustNot |
|-------|-----------|---------|
| `лампа` | lamps | led (лампочка) |
| `майка хлопок` | knit-top | textiles-raw |
| `hdmi кабель` | cascade / power | bare POLICY «кабель» |
| `лимонад` | beverages | fruit-fresh |
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

**Доступ:** на Preview включён Vercel Deployment Protection (`ssoProtection: all_except_custom_domains`). Открывать через кнопку **Visit Preview** в PR / Vercel dashboard (SSO под аккаунтом TikhonBaruch). Прямой curl без SSO уходит на `vercel.com/login`. Hostname `ibm-cargo.vercel.app` — **чужой** проект, не custom domain этого приложения.  
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
