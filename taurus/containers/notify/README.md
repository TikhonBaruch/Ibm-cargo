# containers/notify

Каналы уведомлений (**C4**): email / SMS / push.

| | |
|--|--|
| Порт | `4400` |
| Send | `POST /v1/send` `{ channel, to, template, payload }` |
| Outbox | `GET /v1/outbox` |

Domain API шлёт события после approve, SLA_RISK и payments TOPUP (`NOTIFY_SERVICE_URL`).

## Prod email (F17)

Set **one** of:

| Env | Notes |
|-----|--------|
| `RESEND_API_KEY` | Resend API; `SMTP_FROM` = verified from-address |
| `SMTP_URL` | `smtp://user:pass@host:587` or `smtps://…:465` |
| `SMTP_FROM` | Default `noreply@lbm.local` — use real domain in prod |
| `NOTIFY_OPS_EMAIL` | Optional SLA / ops recipient |

Without keys: email stays **`queued` / PENDING** (no fake `delivered`). SMS/push remain stub-delivered.  
Vercel without `NOTIFY_SERVICE_URL`: drain uses inline Resend; without `RESEND_API_KEY` → outbox **FAILED** (not DELIVERED).

Ops check: `npm run ops:track-a -- --vercel`

Checklist: [`docs/knowledge/dual-path-parity.md`](../../docs/knowledge/dual-path-parity.md) · [`runbook.md`](../../docs/knowledge/runbook.md).

```bash
curl -s localhost:4400/v1/send -H 'content-type: application/json' \
  -d '{"channel":"email","to":"client@example.com","template":"ping"}'
```
