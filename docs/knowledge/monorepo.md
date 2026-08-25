# Monorepo / containers

Все сервисы в [`containers/`](../../containers/). Полное описание: [../containers.md](../containers.md).  
**Порядок extract / ответвления:** [`containerization.md`](./containerization.md).  
**Opt-in providers:** [`growth.md`](./growth.md).

| Сервис | Path | Port | Profile | Статус |
|--------|------|------|---------|--------|
| postgres | `containers/postgres` | 5432 | core, web, scale, full | infra |
| redis | `containers/redis` | 6379 | core, web, scale, full | infra |
| api | `containers/api` | 4000 | core, web, scale, full | **C1** Compose cutover; Vercel dual (Prisma-in-Next) |
| ai | `containers/ai` | 4100 | core, web, scale, full | **C3** heuristic-v1 ± llm enrich |
| worker | `containers/worker` | 4200 | core, web, scale, full | SLA_TICK live |
| payments | `containers/payments` | 4300 | scale, full | **C4** stub / ЮKassa → webhook TOPUP |
| notify | `containers/notify` | 4400 | scale, full | **C4** outbox + optional email |
| llm | `containers/llm` | 4500 | scale, full | stub / OpenAI classify+duty |
| logistics | `containers/logistics` | 4600 | scale, full | demo-3pl / stub quotes+tracking |
| web | `containers/web` | 3000 | web, full | full Next; slim scaffold **C5** |
| admin | `containers/admin` | 3001 | split, full | Next **D20** done |
| broker | `containers/broker` | 3002 | split, full | Next **D16** done |
| client | `containers/client` | 3003 | split, full | Next **D17** done |
| gateway | `containers/gateway` | 8080 | full | infra; `smoke:gateway` |

```bash
npm run docker:core     # бэкенд
npm run docker:web      # + монолит UI
npm run docker:split    # admin/broker/client Next
npm run docker:scale    # + payments/notify/llm/logistics
npm run docker:full     # + gateway
```

Gateway paths: `llm` → `/api/llm/`, `logistics` → `/api/logistics/`.
