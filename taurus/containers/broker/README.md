# containers/broker

Отдельное Next-приложение кабинета брокера (ADR **D16**).

| | |
|--|--|
| Compose | `broker` (profiles `split`, `full`) |
| Порт | `3002` |
| Gateway | `/broker-app/` |
| Shared UI | monorepo `src/components/ved/broker/*` (Docker COPY; no checked-in dual tree) |
| API | rewrite → `WEB_API_ORIGIN` (`http://web:3000` в compose) |

```bash
# из корня репозитория
docker compose --profile split up --build broker

# локально (нужен web для /api)
cd containers/broker && npm install && NEXT_PUBLIC_BROKER_BASE= npm run dev
```

Auth: общий `NEXTAUTH_SECRET`; login redirect на web `/login`.  
Рабочий UI в Vercel по-прежнему `/broker/*` в корневом Next.  
Инвентарь: [`docs/knowledge/cabinets/broker/`](../../docs/knowledge/cabinets/broker/).
