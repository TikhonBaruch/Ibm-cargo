# containers/ai

AI draft service (**C3**, engine `heuristic-v1`). Контракт: [`docs/knowledge/ai-pipeline.md`](../../docs/knowledge/ai-pipeline.md).

| | |
|--|--|
| Порт | `4100` |
| Health | `GET /health` → `{ engine: "heuristic-v1" }` |
| Draft | `POST /v1/draft` `{ description, title?, country?, docs[] }` |

`src/lib/ved/ai.ts` → `AI_SERVICE_URL` / `AI_URL`; локальный fallback = тот же heuristic.  
Правила: общий [`src/lib/ved/ai-draft-rules.json`](../../src/lib/ved/ai-draft-rules.json) (Docker COPY + monorepo path).

```bash
docker compose --profile core up --build ai
curl -s localhost:4100/v1/draft -H 'content-type: application/json' \
  -d '{"description":"ноутбук 16 дюймов","country":"Китай"}'
```

Модели Classification/Duty — отдельная задача поверх того же контракта.
