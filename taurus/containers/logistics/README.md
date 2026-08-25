# containers/logistics

Growth stub: будущий 3PL (котировки + трекинг). Без реального перевозчика.

| | |
|--|--|
| Порт | `4600` |
| Profile | `scale`, `full` |
| Gateway | `/api/logistics/` |
| Health | `GET /health` |
| Quotes | `POST /v1/quotes` |
| Tracking | `POST /v1/tracking` · `GET /v1/tracking/:code` |

```bash
npm run docker:scale
node containers/logistics/src/index.js
curl -s localhost:4600/v1/quotes -H 'content-type: application/json' \
  -d '{"origin":"Шанхай","destination":"Москва","mode":"LCL"}'
```

Domain shipping / Next API опционально читают `LOGISTICS_SERVICE_URL`; иначе [`buildStubShippingQuotes`](../../src/lib/ved/domain.ts).
