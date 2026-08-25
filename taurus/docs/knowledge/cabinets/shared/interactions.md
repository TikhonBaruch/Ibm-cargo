# Кросс-ролевая матрица взаимодействий

| Актор | Действие | Клиент | Брокер | Админ / система |
|-------|----------|--------|--------|-----------------|
| Client | pay + preferred | — | queue «для вас»/reserved | ledger charge |
| Client | chat | waitingOn | threads «ответ» | — |
| Client | SUPPORT | ticket + thread + archive; deep-link `/support?threadId=` и `/orders?id=` | **нет inbox** | `/admin/support` reply / close / archive |
| Broker | claim | chat доступен | IN_REVIEW | — |
| Broker | approve | DONE+PDF | ACCRUED | finance PAID later |
| Admin | assign | — | mine | preferred override |
| Admin | escalate | StatusPill | SLA_RISK UI | attention |
| Broker | escalate own IN_REVIEW | StatusPill | SLA_RISK | attention |
| Admin | REJECT broker | нет в BrokersPane | — | — |
| Admin | PAID | — | payouts | — |
| Worker | SLA tick | status | SLA_RISK / preferred clear | notify optional |

## Сквозные сценарии

1. **S1–S3:** create → AI_READY → pay → QUEUED → claim → map → approve → DONE  
2. **Preferred:** pay → reserved → timeout → open claim  
3. **D-THREAD:** claim → chat ↔ waitingOn  
4. **Money:** topup → pay → ACCRUED → admin PAID  
5. **Escalate:** admin/tick/broker(own IN_REVIEW) → SLA_RISK  

Диалоги S1–S6: [`../../core-dialogues.md`](../../core-dialogues.md).