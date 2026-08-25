# Тестирование

## Стек

- **Vitest** (Jest-compatible API: `describe` / `it` / `expect`), `pool: threads`
- **Structure gate** `scripts/verify-structure.cjs` — ownership, forbidden literals, docs
- Опциональные **E2E** против прод/preview (`tests/e2e`, флаг `RUN_E2E=1`)
- Опциональные **DB integration** (`*.integration.test.ts`, флаг `RUN_DB_INTEGRATION=1`, живой PrismaClient)
- Контрольный шлюз `npm run test:verify` (`scripts/verify-tests.cjs`)

Каркас: [`skeleton.md`](./skeleton.md) · ADR **D18**.  
Ответвления контейнеров: [`containerization.md`](./containerization.md) · ADR **D19**.  
Связи трёх ветвей (матрица, дубли, gaps): [`testing-branches.md`](./testing-branches.md).  
Диалоги ядра: [`core-dialogues.md`](./core-dialogues.md).

## Три ветви — кто чем тестируется

| Ветвь | Unit | Live smoke | E2E |
|-------|------|------------|-----|
| 1 Клиент | create/pay/ledger/shipping stub | `smoke:full`, `smoke:client`, `smoke:chat` | client-create-pay |
| 2 Брокер | claim/approve/PATCH items | `smoke:broker`, `smoke:full`, `smoke:chat` | broker-claim-approve (без PATCH) |
| 3 Ядро | domain/invariants/AI/SLA tick/contracts | compose + smokes | auth/redirects |

Подробная матрица S1–S6 и anti-dupe правила: [`testing-branches.md`](./testing-branches.md).

## Стадия MVP + scaffold — что покрыто

| Слой | Покрытие |
|------|----------|
| domain / access / requireRole / PDF escape | unit |
| calculations pay/claim/approve + ledger | unit (mock Prisma) |
| ADR invariants (D8/D10/D11/D15/RBAC) | `invariants.test.ts` |
| Structure / ownership / no synthetic | `test:structure` |
| Inventory + `test:verify` (≥90 passed) | control gate |
| HTTP `/api/v1` live | e2e opt-in **после деплоя** |

## Happy-path smoke (живой сервер)

Реальный путь: create (+optional upload как вложение) → AI heuristic (±LLM enrich) → `AI_READY` → **pay** → `QUEUED` (STANDARD/PRO) → broker claim/approve → клиент `DONE` + PDF. Картинка в LLM не уходит; очередь только после оплаты (D11).

Signup path: `smoke:mvp` = register → topup → тот же spine. Результаты prod: [`staging.md`](./staging.md).

```bash
# нужен running app + seed (demo users / balance)
npm run smoke:full
# или
TEST_API_URL=http://localhost:3000 npm run smoke:full
```

Частичные прогоны: `npm run smoke:client` (EXPRESS), `npm run smoke:broker` (PATCH items), `npm run smoke:chat` (S4), `npm run smoke:sla` (S5), `npm run smoke:shipping` (D-SHIP reject), `npm run smoke:gateway` (C5). Unified `smoke:full` — STANDARD S1–S3.

### Broker mapping smoke

Реальный кабинет брокера: очередь (`QUEUED`/`SLA_RISK` после оплаты) → claim → таблица сопоставлений (AI `hsCodeAi` + правка HS/duty/VAT/fee text/number inputs) → «Подтвердить позиции» (`PATCH …/items`) и/или «Утвердить и PDF» (`POST …/approve`) → `DONE`.

Данные «после LLM» — уже сохранённый draft (heuristic ± optional llm-stub enrich); брокер LLM не вызывает. **Нет** статуса «на доработку» и выпадающих списков коррекций — только правка полей mapping и чат. `npm run smoke:broker` проверяет claim → PATCH с изменённым HS/duty → approve → PDF.

## Что после деплоя

E2E бьёт в `TEST_API_URL` (по умолчанию `https://ibm-cargo.vercel.app`).

```bash
TEST_API_URL=https://ibm-cargo.vercel.app RUN_E2E=1 npm run test:e2e
```

Конфиг: `vitest.e2e.config.ts`. Без `RUN_E2E=1` suites — `describe.skip`.

## Что в growth (не тестируем как MVP-gate)

Внешний carrier API, SMS-auth, mobile UI, C5 slim cutover — см. [`growth.md`](./growth.md).  
Opt-in OpenAI / ЮKassa / email покрываются unit + config; live ключи не обязательны для `test:ci`.

## Команды

| Команда | Назначение |
|---------|------------|
| `npm test` / `npm run test:unit` | Unit + security + invariants под `src/` |
| `npm run test:structure` | Ownership, docs, forbidden, surfaces |
| `npm run test:verify` | Unit + порог ≥90 passed + наличие e2e |
| `npm run test:ci` | unit → structure → contracts → verify |
| `npm run test:contracts` | JSON envelopes `docs/contracts/*` |
| `npm run test:e2e` | Сеть к задеплоенному URL |
| `npm run test:integration` | Opt-in: живой PrismaClient, локальный Postgres (D-SHIP) |
| `npm run lint:logistics` / `test:logistics` | Pre-commit gate (husky): ESLint + vitest logistics/shipping |
| `npm run test:integration` | Opt-in: живой PrismaClient (локальный Postgres, D-SHIP) |
| `npm run smoke:full` | Opt-in: upload→STANDARD→pay→claim→approve→DONE |
| `npm run smoke:client` | Opt-in: EXPRESS create/pay niche |
| `npm run smoke:broker` | Opt-in: claim→PATCH mapping→approve→DONE |
| `npm run smoke:chat` | Opt-in: S4 chat + waitingOn flip |
| `npm run smoke:sla` | Opt-in: S5 POST internal sla-tick |
| `npm run smoke:shipping` | Opt-in: D-SHIP reject until DONE |
| `npm run smoke:gateway` | Opt-in: C5 gateway cookie auth (`:8080`) |
| `npm run test:watch` | Watch-режим |

## Структура

```
src/lib/ved/__tests__/     # domain, access, security, calculations, ledger, invariants, worker stop
src/lib/ved/__tests__/*.smoke.test.ts  # SIGTERM api smoke (mock exit; в test:ci)
src/lib/ved/__tests__/*.integration.test.ts  # opt-in живой Prisma (не в test:ci)
src/lib/__tests__/         # utils, requireRole, test-control
tests/e2e/                 # opt-in network checks
scripts/verify-tests.cjs   # порог покрытия
scripts/verify-structure.cjs  # каркас / ownership
scripts/verify-contracts.cjs  # docs/contracts envelopes
scripts/smoke-*-path.mjs   # live S1–S5 / shipping smokes
scripts/smoke-gateway-auth.mjs  # C5 gateway
docs/knowledge/testing-branches.md  # матрица трёх ветвей
AGENTS.md                  # правила агентов
.cursor/rules/ved-*.mdc    # Cursor rules
```
