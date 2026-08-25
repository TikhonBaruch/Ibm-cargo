# services/ocr

OCR / docs-ingest (LBM landing: **AI OCR**).  
Contract: `contracts/d-ocr.ai.json` (synced with LBM).

**Canon** for extract HTTP (LBM D35). Mirror: LBM `containers/ocr` via `npm run sync:ai-matrix` or `OCR_DOCKER_CONTEXT=../llm/services/ocr`.

| | |
|--|--|
| Port | `4700` |
| Extract | `POST /v1/extract` |
| Table | `POST /v1/extract-table` |
| Health | `GET /health` |

Text-layer PDF via `unpdf` (`ocr-pdf-text-v1` / `ocr-pdf-table-v1`).  
Optional vision: `OPENAI_API_KEY` / Qwen VL + `imageBase64` → `ocr-vision-v1`.  
Fail-open stub otherwise. Vendors stay as env profiles inside this service — not separate folders.

```bash
PORT=4700 npm start
curl -s localhost:4700/v1/extract -H 'content-type: application/json' \
  -d '{"hint":"ноутбук Lenovo","filename":"invoice.pdf"}'
```
