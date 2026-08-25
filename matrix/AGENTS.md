# LLM Matrix — agent rules

HTTP-матрица AI-сервисов для **ibm-cargo** (приложение в корне репозитория).  
App владеет Calculation FSM (D8), pay gate (D11), ledger, cabinets.  
Этот каталог владеет **только model HTTP APIs**.

## Invariants

1. **Frozen envelopes** under `contracts/` — do not break request/response shapes when swapping providers.
2. **Fail-open** for app create path: classify/OCR errors must not require callers to abort.
3. **No Calculation FSM** here — no statuses, pay, queue, Prisma.
4. **UI never calls** these services; app domain/`containers/ai` call via `*_SERVICE_URL`.
5. Keep **classification** `/v1/classify` + `/v1/duty` compatible with `docs/contracts/d-draft.llm.json` / `LLM_SERVICE_URL`.
6. Keep **ocr** `/v1/extract` compatible with `docs/contracts/d-ocr.ai.json` / `OCR_SERVICE_URL`.
7. **lookup-v1**: TN VED classify uses `data/tnved/normalized/codes.jsonl` (lexical top-K → LLM pick among candidates); duty from leaf. Mount via `TNVED_CODES_PATH` in app compose — separate from Prisma `TnvedCode` import.
8. New modules (broker/risk/logistics/documents) stay stub until app ADR + env wiring.
9. **Model ≠ service.** New vendors (DeepSeek, Qwen, …) = env profiles + optional classify **chain** inside `services/classification`. Do **not** add `services/deepseek`. New **capability** (risk, documents, …) = new folder under `services/` + contract + ADR/`*_SERVICE_URL`.

## Layout

| Path | Role |
|------|------|
| `services/*` | One HTTP service **per capability** (not per vendor) |
| `chains/` | Profile packs 01-nvidia · 02-qwen-deepseek · 03-deepseek (`AI_CHAIN_ID`); not Docker services |
| `contracts/` | JSON Schema source of truth |
| `docs/` | Matrix, vision, app integration |
| `reference/` | Read-only copies of app adapters |

## Sync with app (repo root)

Этот каталог — **канон** classify/OCR HTTP. `containers/llm` и `containers/ocr` — Compose mirrors.

```bash
# From repo root:
npm run sync:ai-matrix          # copy matrix/ → containers/{llm,ocr}
npm run sync:ai-matrix:check    # fail if mirrors drift
# Or compose build context:
# LLM_DOCKER_CONTEXT=./matrix/services/classification
# OCR_DOCKER_CONTEXT=./matrix/services/ocr
```

Changing an envelope here → update `docs/contracts` (and dual-path callers if needed).  
See `docs/integration.md`, ADR **D35** / `../docs/knowledge/plan-parallel-ownership.md`.
