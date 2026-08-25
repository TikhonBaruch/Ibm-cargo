# containers/llm

Classification / Duty behind frozen envelopes (`d-draft.llm.json`).  
`POST /v1/draft` остаётся у [`containers/ai`](../ai/) (D21); `ai` enrich через `LLM_SERVICE_URL`.

| | |
|--|--|
| Порт | `4500` |
| Profile | `scale`, `full` |
| Gateway | `/api/llm/` |
| Health | `GET /health` |
| Classify | `POST /v1/classify` |
| Duty | `POST /v1/duty` |

## Canon (D35)

**Источник истины:** sibling-репо `llm` → `services/classification`.  
Эта папка — Compose **mirror** (offline / default build context).

```bash
# Prefer building from matrix:
# LLM_DOCKER_CONTEXT=../llm/services/classification docker compose --profile scale up --build llm

# Or refresh mirror:
npm run sync:ai-matrix
npm run sync:ai-matrix:check
```

**Model ≠ container:** add vendors via `LLM_PROVIDER` / `LLM_CLASSIFY_CHAIN` + named keys — do not add `containers/deepseek`.

## Providers

| Mode | Env | Engine tag |
|------|-----|------------|
| stub (default) | — | `llm-stub-v0` |
| OpenAI-compatible | `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL`, `LLM_CLASSIFY_MODEL`) | `llm-openai-v1` |
| Named classify | `LLM_PROVIDER=deepseek\|qwen` + `DEEPSEEK_*` / `QWEN_*` | `llm-openai-v1` |

**Временно (NVIDIA NIM):** `OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1`, `LLM_CLASSIFY_MODEL=meta/llama-3.1-8b-instruct`.  
Named classify: см. [`plan-ai-mesh.md`](../../docs/knowledge/plan-ai-mesh.md) срез 0. NVIDIA `OPENAI_*` не затирать — OCR/embeddings.

Fail-open: openai errors → stub/lexical. Create calc never fails on LLM.

```bash
npm run docker:scale
# or
OPENAI_API_KEY=nvapi-… OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1 \
  LLM_CLASSIFY_MODEL=meta/llama-3.1-8b-instruct node containers/llm/src/index.js
curl -s localhost:4500/v1/classify -H 'content-type: application/json' \
  -d '{"description":"ноутбук 16 дюймов","country":"Китай"}'
```
