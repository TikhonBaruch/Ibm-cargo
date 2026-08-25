# containers/ocr

OCR / docs-ingest (**P2**). Contract: [`docs/contracts/d-ocr.ai.json`](../../docs/contracts/d-ocr.ai.json).

| | |
|--|--|
| Порт | `4700` |
| Extract | `POST /v1/extract` `{ mediaUrl?, pdfBase64?, imageBase64?, mimeType?, hint? }` |
| Table | `POST /v1/extract-table` — line items / headers+rows |
| Health | `GET /health` |

Engines (fail-open):

| Engine | Когда |
|--------|--------|
| `ocr-pdf-text-v1` | text-layer PDF (unpdf) → attrs |
| `ocr-pdf-table-v1` | text-layer PDF → table items |
| `ocr-vision-v1` | `OPENAI_API_KEY` + imageBase64 |
| `ocr-stub-v0` | fallback |

Domain create merges OCR attrs when `OCR_SERVICE_URL` + item `mediaUrl` (client attrs win).  
Import preview: local `parseProductPdf` → fallback `extract-table`.

## Ownership (D35 / D36)

**Эта папка — LBM-owned** Compose-сервис. Нулевая связка с nested `./llm` / taurus (нет sync).  
Внешняя матрица — только HTTP (`OCR_SERVICE_URL`).

```bash
curl -s localhost:4700/v1/extract -H 'content-type: application/json' \
  -d '{"hint":"ноутбук Lenovo","filename":"invoice.pdf"}'

# Table from base64 PDF:
# curl -s localhost:4700/v1/extract-table -H 'content-type: application/json' \
#   -d '{"pdfBase64":"…","mimeType":"application/pdf"}'
```
