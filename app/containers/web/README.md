# containers/web

Next.js поверхность. По умолчанию **full** (лендинг + `/cabinet` + `/broker` + `/admin` — как Vercel).

| | |
|--|--|
| Compose | `web` (`WEB_SURFACE=full\|slim`) |
| Dockerfile | context = корень репо |
| Порт | 3000 |

**Паритет с продом:** сравнивайте root `npm run dev` / `docker:web` с Vercel — не `docker:split` (`:3001–3003`), у split урезанный CSS и пустой `NEXT_PUBLIC_*_BASE`.

**C5 slim boundary:** [`docs/knowledge/web-slim.md`](../../docs/knowledge/web-slim.md) — scaffold only; не включать slim на Vercel до отдельного cutover.

Связи env: `DATABASE_URL`, `API_SERVICE_URL`, `AI_SERVICE_URL`, `USE_DOMAIN_API=1` (compose only), `NOTIFY_SERVICE_URL`, `PAYMENTS_SERVICE_URL`.  
На Vercel `USE_DOMAIN_API` **не** ставить; demo mock topup — `ALLOW_MOCK_TOPUP=1`.
