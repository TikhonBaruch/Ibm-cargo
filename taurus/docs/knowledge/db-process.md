# DB-процесс заявки (очередность обращений)

Канон порядка записей в Postgres по жизненному циклу **Calculation**.  
ADR: **D23**. Статусы: **D8**. Оплата до очереди: **D11**. Данные товаров/ТН ВЭД/событий: **D24** / [`data-model.md`](./data-model.md).  
Диалоги HTTP: [`core-dialogues.md`](./core-dialogues.md).  
Код: `src/lib/ved/calculations.ts`, `ledger.ts`, `domain.ts` (+ зеркало `containers/api`).

«Регистрация заявки» = create `Calculation`. **Signup** User+Company — `/register`, `POST /api/v1/auth/register` (**D25** MVP). Брокер публично не регистрируется.

## Live vs legacy статусы

| Класс | Статусы | Runtime |
|-------|---------|---------|
| Live happy-path | `AI_PROCESSING` → `AI_READY` → `QUEUED` \| `DONE` → `IN_REVIEW` → `DONE` | writers в domain |
| Live side | `SLA_RISK` | `runSlaTick` / `escalateSla` (admin QUEUED\|IN_REVIEW; broker own IN_REVIEW) |
| Legacy / reserved | `DRAFT`, `AWAITING_PAYMENT`, `CANCELLED` | в enum и `canTransition`; create **не** пишет `DRAFT`; pay **принимает** `AWAITING_PAYMENT`, если уже в БД |

Все мутации статуса проходят `assertTransition` → `canTransition`.

## Сценарии и атомарность

| ID | Шаг | Атомарность | Порядок DB |
|----|-----|-------------|------------|
| S-REG | Create + draft | Phase A одна tx; AI out-of-tx; Phase B одна tx | A: `Calculation`+`CalculationItem[]` (`AI_PROCESSING`). B: item HS/duty/VAT + calc → `AI_READY` |
| S-PAY | Pay + ledger | **Одна** `$transaction` | lock `Company` → balance ↓ → `LedgerEntry` `TARIFF_CHARGE` → calc `QUEUED`\|`DONE` + `paidAt` |
| S-CLAIM | Claim | Одна tx | conditional update `QUEUED`\|`SLA_RISK` → `IN_REVIEW` + `BrokerAssignment` + `ChatThread` |
| S-MAP | PATCH items | Одна tx | item updates + агрегат calc (статус без смены) |
| S-APPROVE | Approve | Tx1: items + `DONE`+PDF + `ServiceOutbox` PENDING; Tx2: `BrokerPayout` | kick notify after commit (best-effort) |
| S-CHAT | Chat | без общей tx (thread find/create → message) | не меняет calc status / не обходит pay |
| S-TOPUP | Topup | Одна tx | balance ↑ + `LedgerEntry` `TOPUP` + `ServiceOutbox` PENDING |
| S-SLA | SLA tick | per-row tx | status/`preferred` + `ServiceOutbox` PENDING |
| S-SHIP | Shipping after DONE | quotes out-of-tx; insert `ShippingRequest` | D15: только `DONE` → статус `QUOTED`; трекинг `IN_TRANSIT`/`DELIVERED`. Writer: `shipping.ts`. Тесты: `shipping.integration.test.ts` (opt-in DB) |

**Идемпотентность pay:** если уже `paidAt` и status ∈ {`QUEUED`,`IN_REVIEW`,`DONE`,`SLA_RISK`} — вернуть текущий calc **без** повторного charge.

**Recovery create:** падение после Phase A оставляет `AI_PROCESSING` (допустимо; Phase B повторяем / ops).

## Инвентарь: что обязательно в процессе БД

| Шаг | Обязательные модели | Обязательные поля / записи |
|-----|---------------------|----------------------------|
| Регистрация | `Company`, `User` (CLIENT), `TariffPlan`, `Calculation`, `CalculationItem[]`, `CalculationEvent` | `status` A→B, `number`, `tariffCode`/`tariffId`, реальные item id (не `synthetic`), optional `attrs`, `aiDraft` / item `hsCodeAi`+`tnvedCode`+duty/VAT; events `CREATED`/`AI_DRAFT` |
| Оплата | `LedgerEntry` (`TARIFF_CHARGE`), `Company.balanceRub`, `Calculation`, `CalculationEvent` `PAID` | `paidAt`; очередь: `queuedAt`, `slaDeadline`, `QUEUED`; Express DONE: `doneAt`, `pdfHtml`, `hsCodeFinal` |
| Claim | `Calculation`, `BrokerAssignment`, `ChatThread`, `CalculationEvent` `CLAIMED` | `brokerUserId`, `claimedAt`, `IN_REVIEW`, thread `waitingOn=BROKER` |
| Mapping | `CalculationItem`, агрегат `Calculation`; optional `CalculationEvent` `ITEM_MAPPED` | HS/duty/VAT/fee item-level + `tnvedCode` soft; **не** `TariffPlan.priceRub` |
| Approve | `Calculation`, items; optional `BrokerPayout`; `CalculationEvent` `APPROVED` | `DONE`, `doneAt`, `pdfHtml`, `hsCodeFinal` |
| Chat | `ChatThread`, `ChatMessage` | `calculationId`, `body`; flip `waitingOn` |
| Topup | `Company`, `LedgerEntry` (`TOPUP`) | `balanceAfter` согласован с балансом |
| SLA | `Calculation` | `SLA_RISK` и/или `preferredBrokerUserId=null` |
| Справочник ТН ВЭД (D24) | `TnvedCode`, `TnvedDutyRate` | lookup/import; не в hot path create/pay |

Вне DB-процесса (не блокируют commit статуса): HTTP к `containers/ai` / llm; **kick** notify после commit (best-effort). Сама запись `ServiceOutbox` — **в той же tx**, что approve / SLA / TOPUP (D26). Logistics quotes — out-of-tx.

**История (D24):** `CalculationEvent` пишется в той же tx, что и мутация (create / draft / pay / claim / map / approve). Не заменяет `assertTransition`.

**Оркестрация контейнеров (D26):** `BackgroundJob` / `ServiceOutbox` / `ServiceCall` — infra; не дублируют D8. См. [`containerization.md`](./containerization.md), [`d-orch.core.json`](../contracts/d-orch.core.json).

| Шаг | Infra после commit |
|-----|-------------------|
| Approve / SLA / TOPUP | `ServiceOutbox` PENDING → worker `OUTBOX_DRAIN` → notify |
| Create AI | `ServiceCall` ai/draft |
| Worker interval | enqueue `BackgroundJob` SLA_TICK + OUTBOX_DRAIN |

## Правила транзакций (кратко)

1. **Ledger + pay status** — никогда не разносить по двум commit.
2. **Claim** — только conditional update по status; 0 rows → conflict.
3. **Company balance** — `SELECT … FOR UPDATE` (или эквивалент) внутри interactive tx перед charge/topup.
4. **Approve payout** — отдельная короткая tx после DONE (не distributed saga).
5. **LLM** — не пишет в Postgres; в DB только persisted draft fields.

## Тесты

Unit: `domain` (`assertTransition`), `ledger`, `calculations` (pay idempotent, claim conflict, create phases).  
CI: `npm run test:ci`. Live spine: `smoke:full` / `broker` / `chat` / `sla` — см. [`testing-branches.md`](./testing-branches.md).
