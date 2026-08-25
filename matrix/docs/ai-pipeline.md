# AI pipeline (Taurus ↔ matrix)

Adapted from `docs/knowledge/ai-pipeline.md`.

```text
ClientRequest (Taurus)
    → [optional] OCR_SERVICE_URL → this repo services/ocr /v1/extract
    → containers/ai heuristic draft  (± LLM_SERVICE_URL → classification classify+duty)
    → BrokerQueue (if tariff / low confidence)
    → BrokerConfirm
    → ClientResult + PDF
```

Heuristic `/v1/draft` остаётся у **Taurus** `containers/ai` (D21).  
Эта матрица **не** владеет `/v1/draft`.

## Classification (`services/classification`)

| Method | Path | Response |
|--------|------|----------|
| POST | `/v1/classify` | `{ hsCode, confidence, engine, disclaimer }` |
| POST | `/v1/duty` | `{ customsDutyPercent, vatPercent, feeRub, engine }` |
| GET | `/health` | `{ ok, provider: "stub"\|"openai", profile?, … }` |

| Provider | Env | engine tag |
|----------|-----|------------|
| stub | — | `llm-stub-v0` |
| OpenAI-compatible | `OPENAI_API_KEY` or `LLM_PROVIDER` + named key | `llm-openai-v1` |

Ошибка openai → stub. Create calc в Taurus не падает (S6 / fail-open).

## OCR (`services/ocr`)

`POST /v1/extract` → `{ engine, text, attrs, confidence, disclaimer }`. Fail-open.

## Future matrix endpoints

| Service | Path |
|---------|------|
| broker | `POST /v1/advise` |
| risk | `POST /v1/assess` |
| logistics | `POST /v1/route` |
| documents | `POST /v1/validate` |

Wiring в Taurus — отдельный ADR + env (не в этом репо).
