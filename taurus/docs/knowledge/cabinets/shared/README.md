# Shared — оболочка и кросс-роль

## VedShell / общие виджеты

| Элемент | Роль |
|---------|------|
| VedShell | Nav, title/lead, footer, actions, avatar, logout |
| StatusPill | Подписи статусов calc |
| EventsTimeline | D24 `CalculationEvent` (client OrderDetail, broker WorkMapping) |
| Error banner | Глобальные ошибки API в кабинетах |
| Uploads | `POST /api/v1/uploads` (S3 на Vercel; 503 без `S3_*`) |
| Placeholder thumbs | Нет `mediaUrl` |

## Контейнеры extract ↔ web

| Правило | Статус |
|---------|--------|
| UI только из `src/components/ved` (Docker COPY) | OK — dual tree запрещён `test:structure` |
| Нет `@prisma/client` в client/broker/admin package | OK (D16/D17/D20) |
| API rewrite → web / domain api | Compose `WEB_API_ORIGIN` |
| Gateway `/client-app/` `/broker-app/` `/admin-app/` | C5 scaffold |

## Связанные доменные контейнеры (не UI)

| Контейнер | Связь с кабинетами |
|-----------|-------------------|
| `containers/api` | create/pay/claim/approve/chat при `USE_DOMAIN_API` |
| `containers/worker` | SLA_TICK → SLA_RISK, preferred release |
| `containers/ai` / `llm` | draft; UI не вызывает LLM напрямую |
| `containers/payments` | topup checkout/webhook |
| `containers/notify` | email outbox → durable `ServiceOutbox` (D26) |
| `containers/worker` | SLA tick + `BackgroundJob` / OUTBOX_DRAIN |
| `containers/logistics` | shipping quotes (client shipping UI) |

См. [`interactions.md`](./interactions.md) · [`correctness.md`](./correctness.md).
