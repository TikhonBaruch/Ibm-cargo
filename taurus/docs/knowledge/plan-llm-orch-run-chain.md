# План: orch ↔ llm-контейнеры + runChain

**Дата:** 2026-08-23. **D33.**  
После: чистка правил AGENTS / `ved-*.mdc` + sync в `.cursor/rules`.

## Цель

Единая точка выбора цепочки и транспорта к capability-сервисам без Docker-на-вендора.

```
UI → Taurus orch (AI_DRAIN)
  → Mode B: HTTP → containers/llm + ocr   (OCR_SERVICE_URL / LLM_SERVICE_URL)
  → Mode A: in-process mesh + AI_CHAIN_ID  (Vercel keys)
```

## Анализ

- Mode A (Vercel): mesh in-process + `AI_CHAIN_ID`.
- Mode B (Compose): `LLM_SERVICE_URL` / `OCR_SERVICE_URL` → `containers/{llm,ocr}` mirrors.
- Цепочки 1/2/3 в `chains/registry`; transport в `chains/transport` + `run-chain`.

## Структура

| # | Что | Status |
|---|-----|--------|
| 1 | Slim AGENTS + `ved-*.mdc`; `sync:cursor-rules` | **done** |
| 2 | `chains/run-chain.ts` — vision+classify helpers | **done** |
| 3 | `ai-pipeline` → runChain (mesh path) | **done** |
| 4 | `docker-compose.chain-03.yml` + KB/environments | **done** |
| 5 | Документ Mode A/B в `transport.ts`; `describe`/`classify`/`reset` в runChain | **done** |
| 6 | Pipeline: один путь vision+classify (service\|mesh) | **done** |
| 7 | Mode B `containers/api` drain: прокидывает `chainId` в OCR/LLM | **done** |
| 8 | OCR: `chainId`/`AI_CHAIN_ID` → Qwen или DeepSeek vision; sync matrix | **done** |

## Жёстко

Fail-open · model≠container · UI≠matrix · envelope sync.

## Дальше

- Classification service: явный учёт `chainId` в логах/engine (сейчас профиль env).
- NVIDIA chain 1 vision adapter (сейчас fallback Qwen).
