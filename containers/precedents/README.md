# Precedents typeahead (C4)

HTTP service for **«Прецеденты из прошлых заявок»** field suggestions.

- Contract: [`docs/contracts/d-suggest.json`](../../docs/contracts/d-suggest.json)
- Domain canon: [`src/lib/ved/precedent-suggest/`](../../src/lib/ved/precedent-suggest/)
- Next BFF: `POST /api/v1/suggest/query` (proxies when `PRECEDENTS_SERVICE_URL` set)

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | — |
| POST | `/v1/suggest/query` | `x-internal-key` + `x-user-id` |

Request body: `{ kind, q?, limit? }`. Query guard blocks SQL/script/garbage before Prisma lookup.

## Compose

Profile `scale` / `full`. Port `4800`. Requires postgres (same DB as api/web).

```bash
PRECEDENTS_SERVICE_URL=http://precedents:4800 npm run docker:scale
```

When unset, Next route searches via Prisma in-process (Vercel default).

## Local dev

```bash
cd containers/precedents && npm install
DATABASE_URL=postgresql://... npm run dev
```
