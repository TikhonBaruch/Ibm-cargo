# containers/manufacturer

Отдельное Next-приложение кабинета производителя (ADR **D31**).

| | |
|--|--|
| Compose | `manufacturer` (profiles `split`, `full`) |
| Порт | `3004` |
| Gateway | `/manufacturer-app/` |
| Shared UI | monorepo `src/components/ved/manufacturer/*` (Docker COPY; no checked-in dual tree) |
| API | rewrite → `WEB_API_ORIGIN` (`http://web:3000` в compose) |

```bash
# из корня репозитория
docker compose --profile split up --build manufacturer

# локально (нужен web для /api)
cd containers/manufacturer && npm install && NEXT_PUBLIC_MANUFACTURER_BASE= npm run dev
```

Auth: общий `NEXTAUTH_SECRET`; login redirect на web `/login`.  
Роль `MANUFACTURER` — только инвайт ADMIN / seed (`manufacturer@example.com`), не `/register` (D25).  
Рабочий UI в Vercel: `/manufacturer/*` в корневом Next.  
Инвентарь: [`docs/knowledge/cabinets/manufacturer/`](../../docs/knowledge/cabinets/manufacturer/).
