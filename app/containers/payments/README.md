# containers/payments

Эквайринг stub (**C4**): intent → confirm → webhook `LedgerEntry` TOPUP на domain API.

| | |
|--|--|
| Порт | `4300` |
| Profile | `scale`, `full` |
| Gateway | `/api/payments/` |
| Intent | `POST /v1/intents` `{ amountRub, companyId, userId?, method?: stub\|sbp\|card }` |
| Checkout | `POST /v1/checkout` — create + auto-confirm (MVP one-shot) |
| Confirm | `POST /v1/intents/:id/confirm` → `WEBHOOK_TARGET` |
| Webhook | default `http://api:4000/v1/webhooks/payments` |

```bash
npm run docker:scale
curl -s localhost:4300/v1/checkout -H 'content-type: application/json' \
  -d '{"amountRub":5000,"companyId":"<id>","method":"stub"}'
```

Клиентский topup (`POST /api/v1/company/topup`) при `PAYMENTS_SERVICE_URL` идёт в checkout; иначе mock credit (D13).

Провайдер (ЮKassa / CloudPayments) подключается без смены webhook-контракта.
