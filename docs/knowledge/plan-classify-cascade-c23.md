# План: domain classify cascade (C23–C27)

**Дата:** 2026-08-28. **D33.**  
Канон: lab [`tnved-lookup.ts`](../../src/lbm-bro/lib/tnved-lookup.ts) · live AI [`ai.ts`](../../src/lib/ved/ai.ts) · OCR [`plan-ocr-vision.md`](./plan-ocr-vision.md).

## Идея

Перенести lab cascade `code → alias → token index` на live **server domain** (Postgres + merged aliases), без `tnved.json` в браузере и без Tesseract в `/cabinet`. Precedent остаётся первым; cascade — до heuristic-v1 и до AI_DRAIN.

## Фазы

| ID | Что | Статус |
|----|-----|--------|
| C23 | `tnved-classify.ts` + wire `requestAiDraft` | done |
| C24 | merged aliases (lab + invoice), exclude/risk в classify | done |
| C25 | `product-classify-text.ts` + `extractWithOcr` image/* | done |
| C26 | FieldSuggest / classify-preview / import cascade | done |
| C27 | audit fixture + `npm run test:classify-cascade` | done |

## Не делать

Browser Tesseract · `tnved.json` в client · classify в `/cabinet/tnved` · финал без брокера (D15).

## Проверка

Unit must-cover (C19 tokens + lab exclude). `npm run test:ci`. Hygiene C10–C12.
