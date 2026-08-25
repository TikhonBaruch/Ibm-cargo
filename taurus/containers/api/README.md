# containers/api

Domain API extract (**C1** cutover). Session face remains Next `/api/v1` → proxy when `USE_DOMAIN_API=1`.

| | |
|--|--|
| Port | `4000` |
| Health | `GET /health` |
| Auth | `x-internal-key` + `x-user-id` (+ `x-user-role`) |

## Routes

| Method | Path | Notes |
|--------|------|-------|
| GET | `/v1/me` | user + company + brokerProfile |
| GET | `/v1/tariffs` | active tariffs (internal key) |
| GET | `/v1/brokers` | list (+ `?all=1`) |
| GET | `/v1/calculations` | list (`status`, `scope`, `q`) |
| GET | `/v1/calculations/:id` | detail |
| GET | `/v1/calculations/:id/pdf` | HTML report |
| POST | `/v1/calculations` | create + heuristic AI draft (± OCR/LLM fail-open) |
| POST | `/v1/calculations/:id/pay` | balance debit → QUEUED/DONE (+ payments/llm/notify gates) |
| POST | `/v1/calculations/:id/claim` | preferred timeout aware |
| POST | `/v1/calculations/:id/approve` | real item ids, D10 limits |
| GET/POST | `/v1/chat` | `waitingOn` |
| GET | `/v1/payouts` | broker profile payouts |
| POST | `/v1/company/topup` | mock balance credit (`paymentsEnabled` / `mockTopupAllowed`) |
| POST | `/v1/shipping` | DONE-only → QUOTED stub |
| POST | `/v1/internal/sla-tick` | escalate + release preferred |
| GET | `/v1/internal/orch/health` | D26 deps incl. payments/llm/ai/notify/logistics/**ocr** |
| GET | `/v1/platform/integrations` | ADMIN: health + ServiceCall I/O + toggles |

Compose `web` defaults: `USE_DOMAIN_API=1`, `DOMAIN_API_URL=http://api:4000`.  
Vercel: leave unset — Next keeps Prisma handlers.

**Shutdown:** SIGTERM/SIGINT → `server.close` → `prisma.$disconnect()` → exit 0  
(`graceful-shutdown.js`; канон `src/lib/ved/graceful-shutdown.ts`). Smoke: `api-sigterm.smoke.test.ts`.

**Image (12-Factor):** `prisma generate` на build; `CMD ["node","src/index.js"]` (PID 1); `USER appuser`.

```bash
docker compose --profile core up --build api
```
