# План: live UX результата AI-классификации (C22)

**Дата:** 2026-08-28. **Цикл D33.**  
Канон lab: [`client-wizard.tsx`](../../src/lbm-bro/components/client-wizard.tsx) step 4 · live create: [`ClientCabinet.tsx`](../../src/components/ved/ClientCabinet.tsx) + `AI_DRAIN` · D15/D27.

## Идея

На live `/cabinet/orders/[id]` и при create показать тот же опыт, что lab `/client/new` step 4: спиннер «AI подбирает код», уверенность, «Почему этот код» из `aiDraft.disclaimer`. Без выдачи финала без брокера.

## As-is → to-be

| | Lab | Live до C22 | Live после C22 |
|---|-----|-------------|----------------|
| Ожидание | `ai-run` + ротация статусов | текст внизу | `AiRunCard` над hero |
| Почему | `classifyProduct().why` | `description` + статичный «Риск» | `aiDraft.disclaimer` |
| Уверенность | % + `.conf` | есть, без warn | warn при низкой conf |
| Когда AI | после оплаты (demo) | на create + drain | copy «предварительный / подбирает» |

## Структура

1. `ai-drain-client.ts` — `AI_DRAIN_STATUS_MSGS`.
2. `ai-classification-copy.ts` — conf %, disclaimer, warn/ok titles.
3. `AiRunCard.tsx` — reuse `.ai-run` / `.ring`.
4. `OrderDetail.tsx` — hero + why; убрать дубль alert.
5. `NewCalcPane.tsx` — sidebar ai-run при `enriching`.

## Проверка

Unit copy helpers. Hygiene C10–C12. `npm run test:ci`. Ручной: create → spinner → код + disclaimer.

## Не делать

Финальный код без брокера. Pay-first narrative lab. `consumeFreeHs`. LLM CTA на NewCalc без ADR.
