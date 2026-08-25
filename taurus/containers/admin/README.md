# containers/admin

Отдельное Next-приложение VED-админки (ADR **D20** / C2). Legacy CMS (posts/…) остаётся в корневом `web` (D6).

| | |
|--|--|
| Compose | `admin` (profiles `split`, `full`) |
| Порт | `3001` |
| Gateway | `/admin-app/` |
| Shared UI | `src/components/ved/AdminVedCabinet.tsx` (+ VedShell) |
| API | rewrite → `WEB_API_ORIGIN` |

```bash
docker compose --profile split up --build admin

cd containers/admin && npm install && NEXT_PUBLIC_ADMIN_BASE= npm run dev
```

Auth: общий `NEXTAUTH_SECRET`; login redirect на web `/login`.  
Рабочий UI в Vercel: `/admin/*` в корневом Next.  
Инвентарь VED: [`docs/knowledge/cabinets/admin/`](../../docs/knowledge/cabinets/admin/). Legacy CMS не в этом контейнере (D6).
