# План: partial chat improvements (notify + smoke + UX)

**Статус:** **done** (2026-08-25).  
Канон: D27 · D37 (smoke на Preview, не taurus).

## Scope

Инкремент без SSE / редизайна / live pay.

| # | Задача | Статус |
|---|--------|--------|
| A1 | `smoke:chat` + `smoke:support` в `smoke:standalone` | **done** |
| B1 | Outbox `chat.message` / `chat.support_*` + notify templates | **done** |
| B2 | Access guard calc chat (client/broker assignee) | **done** |
| B3 | Dual-path `containers/api` parity | **done** |
| C1 | Broker poll 12s на work/chat | **done** |
| C2 | QUEUED — placeholder вместо пустого чата | **done** |
| C3 | VedToast on calc chat send | **done** |
| C4 | Scroll-to-bottom on new messages | **done** |

## Notify templates

| Template | Когда | Получатель |
|----------|-------|------------|
| `chat.message` | POST calc chat | counterparty email |
| `chat.support_new` | client создал тикет | `NOTIFY_OPS_EMAIL` |
| `chat.support_reply` | staff ответил | client email |

Fail-open без `RESEND_API_KEY` / notify host (как approve).

## Smoke

```bash
TEST_API_URL=<preview> npm run smoke:standalone
# включает smoke:chat и smoke:support
```
