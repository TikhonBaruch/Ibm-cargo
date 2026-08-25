# Sources (copied from app / historical Taurus)

Snapshot date: **2026-08-07**. Origin root (historical): `/home/andrey/taurus`.  
Текущий канон app: repo root в репозитории **ibm-cargo** (отдельно от upstream).

| Destination | Source |
|-------------|--------|
| `services/classification/*` | `containers/llm/*` (renamed package `@kargo/llm-classification`; health `service: classification`) |
| `services/ocr/*` | `containers/ocr/*` |
| `contracts/d-classification.llm.json` | `docs/contracts/d-draft.llm.json` (same `$id` / transport; `x-taurusAlias`) |
| `contracts/d-ocr.ai.json` | `docs/contracts/d-ocr.ai.json` |
| `contracts/d-draft.ai.consumer.json` | `docs/contracts/d-draft.ai.json` (consumer reference) |
| `reference/llm-enrich.ts` | `src/lib/ved/llm-enrich.ts` |
| `reference/ocr.ts` | `src/lib/ved/ocr.ts` (sanitizer simplified) |
| `reference/enrich-llm.js` | `containers/ai/src/enrich-llm.js` |
| `reference/ai-draft-rules.json` | `src/lib/ved/ai-draft-rules.json` |
| `docs/ai-pipeline.md` | adapted from `docs/knowledge/ai-pipeline.md` |
| `docs/vision.md` | landing `#features` + `docs/knowledge/product.md` |

**Not copied** (remain app-only): Prisma, cabinets, payments, `containers/ai` draft server, logistics 3PL `:4600`.

Scaffold **new** (not from original copy): `services/{broker,risk,logistics,documents}`, contracts `d-broker|risk|logistics|documents.llm.json`.

Справочники корпусов (не copy из app code): [`sources-tnved.md`](./sources-tnved.md), [`sources-incoterms.md`](./sources-incoterms.md), [`sources-payments.md`](./sources-payments.md). Канон Инкотермс/платежей в единой KB app: `docs/knowledge/incoterms.md`, `customs-payments.md`.
