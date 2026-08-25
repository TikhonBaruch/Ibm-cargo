# Broker — взаимодействия

| Действие | Эффект у других |
|----------|-----------------|
| Claim | `IN_REVIEW` + thread; клиент видит chat |
| PATCH items | Черновик mapping; EventsTimeline; эталон завода **read-only**; товарное описание; прочие сборы; **empty attrs fill** |
| AI `hsCodeAi` | Из heuristic ± corpus+LLM enrich; брокер сверяет через **DB** `tnved/search` (два слоя — [`data-model.md`](../../data-model.md) §2.1) |
| Reclassify + feedback | `POST …/reclassify` → новый HS от LLM (skip precedent); остаётся `IN_REVIEW`; EventsTimeline NOTE |
| Approve | Client `DONE`+PDF (итого без доставки, если есть снимок); payout `ACCRUED`; notify `calc.approved` |
| Client result feedback | `clientFeedback*` на WorkMapping с `AI_READY+`; NOTE в timeline |
| Similar precedents | `similarPrecedents` на GET calc — похожие утверждённые HS, `CLIENT_HELPFUL` выше |
| Escalate (own IN_REVIEW) | `SLA_RISK`; dash/attention; optional notify |
| Chat reply | `waitingOn` CLIENT; client unread KPI |
| **Dossier request** | Шаблон в CALC chat: вес / состав / спирт / двигатель / части; `waitingOn=CLIENT` |
| Soft refresh / «Обновить» | queue / mine / threads / unread без F5 |
| Profile acceptingJobs | Сохраняется; **queue list пустой** + claim blocked (`isBrokerQueueVisible` / `assertBrokerAcceptingJobs`) |

## Входящие от других ролей

| Источник | Эффект в broker UI |
|----------|-------------------|
| Client preferred @ pay | Badge «для вас» / reserved; claim disabled у остальных |
| Client `POST …/feedback` | Отклик 👍/👎 с черновика HS → `BrokerClientFeedback` + вес прецедента `CLIENT_HELPFUL` на approve |
| Client chat (`waitingOn=BROKER`) | Nav badge «Чат» + pill «ответ» в threads |
| Worker preferred timeout | Claim открыт всем |
| Admin assign | Появляется в `mine` |
| Admin escalate / SLA tick | `SLA_RISK` на dash/attention |
| Admin PAID | Статус в PayoutsPane |

## Нет в UI

- Real presence (WebSocket / lastSeen) — F21 = `acceptingJobs` + rating footer, не heartbeat
- Release / unclaim ошибочного claim (только admin assign/escalation)
- Ответ на SUPPORT-тикеты
- SSE/WebSocket чат (REST + soft poll 45с)
- Правка клиентского `Calculation.description` (D15). Товарное описание позиции / прочие сборы — **live** [`plan-broker-desc-fees.md`](../../plan-broker-desc-fees.md)
