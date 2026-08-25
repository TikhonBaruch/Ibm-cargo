# containers/client

Отдельное Next-приложение кабинета клиента (ADR **D17**).

| | |
|--|--|
| Compose | `client` (profiles `split`, `full`) |
| Порт | `3003` |
| Gateway | `/client-app/` |
| Shared UI | monorepo `src/components/ved/client/*` (Docker COPY; no dual tree) |
| API | rewrite → `WEB_API_ORIGIN` (`http://web:3000`) |

```bash
docker compose --profile split up --build client
cd containers/client && npm install && NEXT_PUBLIC_CLIENT_BASE= npm run dev
```

Auth: общий `NEXTAUTH_SECRET`; login redirect на web `/login`.  
Рабочий UI в Vercel: `/cabinet/*` в корневом Next.  
Инвентарь элементов и взаимодействий: [`docs/knowledge/cabinets/client/`](../../docs/knowledge/cabinets/client/).

Routes (parity with `app/cabinet`): `/`, `/orders`, `/new`, `/brokers`, `/shipping`, `/balance`, `/support`, `/settings`, `/profile`.
