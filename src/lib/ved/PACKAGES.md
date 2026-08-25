# Logical packages in `src/lib/ved`

Файлы пока в плоском каталоге (без массового rename).  
Ownership для параллельной разработки — **логические пакеты** ниже.  
Канон контейнеров: [`docs/knowledge/plan-parallel-ownership.md`](../../../docs/knowledge/plan-parallel-ownership.md) · [`ved-ownership.mdc`](../../../docs/knowledge/ved-ownership.mdc).

| Package | Owns | Typical files | Does **not** own |
|---------|------|---------------|------------------|
| **domain** | D8 FSM, ledger, access, calc CRUD, pay gate | `calculations`, `domain`, `access`, `ledger`, `payments`, `chat`, `sku-order`, `manufacturer-*`, `tnved*`, `settings`, `platform-gates`, `logistics`, `shipping` | provider keys, prompts |
| **orch** | BackgroundJob / outbox / ticks / drain retries | `orchestration`, `jobs-tick`, `outbox-drain`, `ai-drain-retry`, `ai-drain-client`, `orch-health`, `worker`, `graceful-shutdown` | classify HTTP shape |
| **mesh** | OpenAI-compatible client, chain profiles, Vercel direct providers, mediaUrl allowlist | `openai-compat`, `provider-mesh`, `chains/` (1 nvidia · 2 qwen-deepseek · 3 deepseek), `media-url`, `llm-enrich`, `ocr`, `ai-pipeline` (wire) | D8 statuses |
| **draft** | Heuristic draft + rules | `ai-draft-engine`, `ai.ts`, `ai-draft-rules.json`, `customs-fees` | vendor SDKs |
| **cabinet helpers** | flags / paths used by UI | `cabinet-features`, `web-surface`, `admin-paths` | panes (→ `src/components/ved/*`) |

## Parallel PR rule

Один PR ≈ один пакет (+ dual-path `containers/api` если трогали domain writers).  
Не смешивать **mesh provider** и **cabinet UI** в одном changeset без необходимости.

## External AI matrix

HTTP classify/OCR/duty живут в репо **`llm`** (`services/classification`, `services/ocr`).  
Taurus `containers/llm` / `containers/ocr` — Compose **mirror**; sync: `npm run sync:ai-matrix`.  
Новая **модель** → env profile / chain в matrix (или Vercel mesh).  
Новая **capability** (risk, documents, …) → новый сервис в `llm` + ADR + `*_SERVICE_URL`, не папка под vendor.
