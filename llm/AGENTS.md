# LLM Matrix — agent rules

External AI service matrix for **LBM** (`Ibm-cargo (this repo)`).  
LBM owns Calculation FSM (D8), pay gate (D11), ledger, cabinets.  
This repo owns **model HTTP APIs** only.

## Invariants

1. **Frozen envelopes** under `contracts/` — do not break request/response shapes when swapping providers.
2. **Fail-open** for LBM create path: classify/OCR errors must not require callers to abort.
3. **No Calculation FSM** here — no statuses, pay, queue, Prisma.
4. **UI never calls** these services; LBM domain/`containers/ai` call via `*_SERVICE_URL`.
5. Keep **classification** `/v1/classify` + `/v1/duty` compatible with LBM `d-draft.llm.json` / `LLM_SERVICE_URL`.
6. Keep **ocr** `/v1/extract` compatible with LBM `d-ocr.ai.json` / `OCR_SERVICE_URL`.
7. **lookup-v1**: TN VED classify uses `data/tnved/normalized/codes.jsonl` (lexical top-K → LLM pick among candidates); duty from leaf. Mount via `TNVED_CODES_PATH` in LBM compose — separate from Prisma `TnvedCode` import.
8. New modules (broker/risk/logistics/documents) stay stub until LBM ADR + env wiring.
9. **Model ≠ service.** New vendors (DeepSeek, Qwen, …) = env profiles + optional classify **chain** inside `services/classification`. Do **not** add `services/deepseek`. New **capability** (risk, documents, …) = new folder under `services/` + contract + LBM ADR/`*_SERVICE_URL`.

## Layout

| Path | Role |
|------|------|
| `services/*` | One HTTP service **per capability** (not per vendor) |
| `chains/` | Profile packs 01-nvidia · 02-qwen-deepseek · 03-deepseek (`AI_CHAIN_ID`); not Docker services |
| `contracts/` | JSON Schema source of truth |
| `docs/` | Matrix, vision, LBM integration; `sources-tnved.md` / `sources-incoterms.md` / `sources-payments.md` |
| `reference/` | Read-only copies of LBM adapters |

## Sync with LBM

This repo is the **canon** for classify/OCR HTTP. LBM `containers/llm` and `containers/ocr` are Compose mirrors.

```bash
# From LBM:
npm run sync:ai-matrix          # copy this repo → containers/{llm,ocr}
npm run sync:ai-matrix:check    # fail if mirrors drift
# Or compose build context:
# LLM_DOCKER_CONTEXT=../llm/services/classification
# OCR_DOCKER_CONTEXT=../llm/services/ocr
```

Changing an envelope here → PR to `docs/contracts` (and dual-path callers if needed).  
See `docs/integration-lbm.md`, `docs/sources.md`, LBM ADR **D35** / `plan-parallel-ownership.md`.
