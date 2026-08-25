# Integration with app (`../taurus`)

Репозиторий: **ibm-cargo** · матрица: `llm/` · app: `taurus/`.  
Развивается отдельно от upstream taurus; пути `/home/andrey/*` не канон.

## Already wireable (as-is app env)

1. Start matrix:

```bash
cd llm
cp .env.example .env
docker compose up --build
# or: PORT=4500 npm run start:classification & PORT=4700 npm run start:ocr &
```

2. Point app:

```bash
# Mode A — Next on host, classification on host:
LLM_SERVICE_URL=http://127.0.0.1:4500
OCR_SERVICE_URL=http://127.0.0.1:4700

# Mode B — app docker compose (profile scale/full):
# LLM_SERVICE_URL is hardcoded to http://llm:4500 for ai/api/web — do NOT use 127.0.0.1 in container env.
```

3. **TN VED corpus (lookup-v1)** — classification loads `codes.jsonl` at startup:

```bash
# In taurus/docker-compose.yml (llm service):
TNVED_CODES_PATH=/data/tnved/codes.jsonl
volumes:
  - ../llm/data/tnved/normalized:/data/tnved:ro
```

Flow: lexical top-K from corpus → optional OpenAI/NIM rerank among candidates only → duty/VAT/fee from leaf metadata. See `services/classification/src/tnved-lookup.js`.

Export for Prisma (broker autocomplete) is separate: `npm run tnved:export-import` → app `POST /api/v1/tnved/import` via `/admin/tnved`. **Do not** mix runtime corpus mount with DB catalog.

4. Optional OpenAI-compatible provider on classification (one profile at a time):

```bash
# NVIDIA NIM (also app OCR / embeddings via OPENAI_*):
OPENAI_API_KEY=nvapi-…
OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1
LLM_CLASSIFY_MODEL=meta/llama-3.1-8b-instruct

# Or classify-only named profile (does not replace OPENAI_* on app OCR):
# LLM_PROVIDER=deepseek
# DEEPSEEK_API_KEY=
# DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
# DEEPSEEK_MODEL=deepseek-chat
# LLM_PROVIDER=qwen
# QWEN_API_KEY=
# QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
# QWEN_MODEL=qwen-plus
```

5. Platform gate in app: `llmEnrichEnabled` — `false` skips enrich (heuristic only).

6. Smoke (from `taurus/`): `npm run smoke:chain-llm` — full chain with local upload + LLM enrich (compose prerequisites).

## Invariants

- **Fail-open** on create: OCR/LLM errors must not block `AI_READY`.
- **UI never calls** matrix URLs (session API / domain only).
- **Do not change D8 FSM** inside this package.
- **lookup-v1**: classify picks HS only from corpus candidates; no free-form HS invention.
- **Envelope sync**: change `contracts/*` here → update `taurus/docs/contracts` (classification ≡ `d-draft.llm.json`, ocr ≡ `d-ocr.ai.json`).
- **Model ≠ service**: vendors = profiles/chains in `services/classification` (or ocr). New capability = new `services/<name>` + app ADR (D35).

## Canon vs app mirrors

| Capability | Canon (this package) | App Compose mirror |
|------------|----------------------|--------------------|
| classify/duty | `services/classification` | `containers/llm` |
| OCR extract | `services/ocr` | `containers/ocr` |

From `taurus/`: `npm run sync:ai-matrix` or `LLM_DOCKER_CONTEXT` / `OCR_DOCKER_CONTEXT`.

## Future four services

| Env (proposed) | Service |
|----------------|---------|
| `AI_BROKER_SERVICE_URL` | broker :4800 |
| `RISK_SERVICE_URL` | risk :4900 |
| `LOGISTICS_AI_SERVICE_URL` | logistics :4601 (≠ `LOGISTICS_SERVICE_URL` 3PL :4600) |
| `DOCUMENTS_SERVICE_URL` | documents :4750 |

Require app ADR + dual-path callers + `ServiceCall` / orch health probes — **out of scope** for this package until then.

## Gateway

Compose gateway publishes `:8088`:

- `/api/llm/` or `/api/classification/` → classification
- `/api/ocr/` → ocr
- `/api/broker|risk|logistics|documents/` → stubs

Useful for local smoke without remembering ports.
