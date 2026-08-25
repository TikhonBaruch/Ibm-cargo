# services/classification

Classification + Duty (Taurus landing: **AI Classification**).  
Envelope compatible with Taurus `d-draft.llm.json` → here `contracts/d-classification.llm.json`.

**Canon for HTTP classify/duty** (Taurus D35). Taurus `containers/llm` is a Compose mirror — sync via `npm run sync:ai-matrix` in Taurus, or build with `LLM_DOCKER_CONTEXT=./matrix/services/classification`.

| | |
|--|--|
| Port | `4500` |
| Health | `GET /health` |
| Classify | `POST /v1/classify` |
| Duty | `POST /v1/duty` |

## Providers (model ≠ folder)

| Mode | Env | Engine tag |
|------|-----|------------|
| stub (default) | — | `llm-stub-v0` |
| OpenAI-compatible | `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL`, `LLM_CLASSIFY_MODEL`) **or** `LLM_PROVIDER` + `DEEPSEEK_*` / `QWEN_*` | `llm-openai-v1` (pick among corpus candidates) |
| Chain | `LLM_CLASSIFY_CHAIN` (e.g. `deepseek,qwen`) when wired by caller/mesh | same envelope |
| Corpus lexical | `TNVED_CODES_PATH` (default `data/tnved/normalized/codes.jsonl`) | `llm-lookup-v1` |

Add a new **vendor** only as env profile inside this service. Add a new **capability** as a sibling under `services/`.

**Temporary local test (NVIDIA NIM):**

```bash
export OPENAI_API_KEY=nvapi-…
export OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1
export LLM_CLASSIFY_MODEL=meta/llama-3.1-8b-instruct
export LLM_DUTY_MODEL=meta/llama-3.1-8b-instruct
export LLM_TIMEOUT_MS=30000
export TNVED_CODES_PATH=data/tnved/normalized/codes.jsonl
PORT=4500 npm start
```

Fail-open: openai errors → lexical top‑1 → stub. Duty rates from leaf, not from the model.

```bash
PORT=4500 npm start
curl -s localhost:4500/v1/classify -H 'content-type: application/json' \
  -d '{"description":"ноутбук 16 дюймов","country":"Китай"}'
```
