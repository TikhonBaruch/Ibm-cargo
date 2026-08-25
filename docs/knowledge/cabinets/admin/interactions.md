# Admin — взаимодействия

**Полная схема** (экраны, API, акторы, existing/required/future): [`schema.md`](./schema.md).

## Быстрая таблица: действие → эффект

| Действие | Эффект |
|----------|--------|
| Assign | Broker `mine`; preferred override; часто `IN_REVIEW` |
| Escalate | `SLA_RISK` → broker/client/admin attention |
| Moderate REJECTED | Брокер исчезает из client BrokersPane (только APPROVED) |
| Pause acceptingJobs | Queue/claim blocked for broker (platform-gates) |
| Payout PAID | Broker PayoutsPane |
| Finance CSV | Export filtered payouts |
| Orch retry | FAILED/DEAD job → QUEUED; outbox → PENDING + OUTBOX_DRAIN |
| TN VED import | Upsert `TnvedCode` / rates |
| Tariffs/SLA/confidence | Pay outcome + SLA deadlines |
| Toggles marketplace/autoAssign/maintenance | Persist + domain enforcement |
| SUPPORT inbox | Reply / Close / Archive / Reopen; chips by `ticketStatus` |
| ADJUSTMENT | Client company balance + ledger + audit |

## Кто с кем (не смешивать)

| Канал | Клиент | Брокер | Admin |
|-------|--------|--------|-------|
| CALCULATION chat | ✓ (по заявке) | ✓ | read via bookings |
| SUPPORT ticket | ✓ (create) | **нет** | ✓ (staff inbox) |
| Mapping HS / approve | — | ✓ | **нет** (D15) |
| Platform gates | потребляет | acceptingJobs | **управляет** |

## Attention list (dashboard)

Low confidence · SLA risk · pending brokers · unpaid payouts — сигналы к bookings / finance / brokers.

## Сквозные сценарии admin

См. [`schema.md`](./schema.md) §5: заявка застряла · деньги · SUPPORT · инцидент интеграции · онбординг брокера.
