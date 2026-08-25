# services/logistics

AI Logistics routing stub (landing: route/carrier by time/price/cargo).  
Port **4601** — does **not** replace Taurus `containers/logistics` 3PL on `:4600`.  
Contract: `contracts/d-logistics.llm.json`. Future env: `LOGISTICS_AI_SERVICE_URL`.

| | |
|--|--|
| Port | `4601` |
| Route | `POST /v1/route` |
| Health | `GET /health` |
