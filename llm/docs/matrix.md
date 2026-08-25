# Service matrix

Landing «Шесть модулей» ↔ this repo ↔ LBM integration.

| Landing module | Service folder | Port | Endpoint(s) | Contract | LBM env |
|----------------|----------------|------|-------------|----------|------------|
| AI Classification | `services/classification` | 4500 | `/v1/classify`, `/v1/duty` | `d-classification.llm.json` | `LLM_SERVICE_URL` (live) |
| AI OCR | `services/ocr` | 4700 | `/v1/extract` | `d-ocr.ai.json` | `OCR_SERVICE_URL` (live, fail-open) |
| AI Broker | `services/broker` | 4800 | `/v1/advise` | `d-broker.llm.json` | future `AI_BROKER_SERVICE_URL` |
| AI Risk | `services/risk` | 4900 | `/v1/assess` | `d-risk.llm.json` | future `RISK_SERVICE_URL` |
| AI Logistics | `services/logistics` | 4601 | `/v1/route` | `d-logistics.llm.json` | future `LOGISTICS_AI_SERVICE_URL` |
| AI Documents | `services/documents` | 4750 | `/v1/validate` | `d-documents.llm.json` | future `DOCUMENTS_SERVICE_URL` |

Gateway (compose): `:8088` → `/api/llm/`, `/api/ocr/`, `/api/broker/`, …

## Maturity

| Service | Maturity |
|---------|----------|
| classification | Working stub + optional OpenAI (copied from LBM `containers/llm`) |
| ocr | Working stub (copied from LBM `containers/ocr`) |
| broker / risk / logistics / documents | Scaffold stubs |

## Naming vs LBM product.md

| Landing | product.md |
|---------|------------|
| Classification | AI Customs + AI Duty |
| Logistics | AI Cargo (AI routing layer; 3PL stays in LBM `containers/logistics`) |
| others | same names |
