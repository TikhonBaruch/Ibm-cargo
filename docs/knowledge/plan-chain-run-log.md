# Plan: online chain probes + analyzable chainRun log

**D33 · 2026-08-23**

## Цель

1. Несколько live-заявок на prod → увидеть цепочку (heuristic → AI_DRAIN → vision?/classify).
2. Журнал, который можно разобрать offline: `aiDraft.chainRun` + `GET …/chain-log` + JSONL probe.

## As-is

- Console `[ai-drain]` + `visionTrace` + `ServiceCall` (ocr/llm).
- Нет единого снимка на calc и нет probe→JSONL.

## Срез

| Артефакт | Назначение |
|----------|------------|
| `src/lib/ved/chain-run-log.ts` | типы + `buildChainRun` / `analyzeCalcChain` (без секретов) |
| `ai-pipeline` | пишет `aiDraft.chainRun` в конце drain |
| `GET /api/v1/calculations/:id/chain-log` | draft + ServiceCalls для owner/ADMIN |
| `scripts/probe-ai-chain.mjs` | N сценариев → `tmp/chain-probes-*.jsonl` |
| KB | этот план + строка в staging |

## Проверка

- Unit: analyze helpers.
- Online: `TEST_API_URL=https://ibm-cargo.vercel.app npm run probe:ai-chain` (≥3 сценария).

## Готово (2026-08-23)

- Код: `chain-run-log` + unit; persist `aiDraft.chainRun`; `GET …/chain-log`; `npm run probe:ai-chain`.
- Prod probes ×4 **PASS** #47927–#47930 (см. `tmp/chain-probes-*.jsonl`, staging).
- На текущем Hobby ещё нет `chainRun`/endpoint (404) — появятся после deploy; анализ уже возможен по `visionTrace` + `llmEnrich` в JSONL.
