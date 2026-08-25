# Plan: гладкий create → AI_DRAIN (smoke + UX + upload)

**Цикл D33.** Срез после prod-проверки 2026-08-23: spine OK, flaky `terminated`, `smoke:chain-llm` ложно падал на S3, UX pending уже частично в toast.

## Идея

Сделать путь «фото → create → уточнение HS» предсказуемее на Vercel и в кабинете без смены оркестрации (Mode A mesh / `after()`).

## Анализ

| Боль | Причина | Фикс среза |
|------|---------|------------|
| `smoke:chain-llm` FAIL на prod | ждёт `storage === "local"` | accept `local` \| `s3`; GET absolute URL |
| «AI считает…» без фазы | нет явного enrich | фазы кнопки + баннер в карточке + poll открытого заказа |
| Upload hang / тяжёлые JPEG | большой payload → S3/Hobby | client compress перед `POST /uploads` |

## Структура

1. Smoke: `scripts/smoke-chain-llm.mjs` (+ poll `llmEnrichPending` до pay, как кабинет).
2. UI: `aiDrainPending` / `llmEnrichPending` в типах; `NewCalcPane` labels; `OrderDetail` banner; `ClientCabinet` poll открытого calc.
3. `compressImageForUpload` + вызов из client/broker upload paths.
4. KB: этот план + строка в `staging.md` / `environments.md`.

## Не в срезе

Pro plan Vercel; смена `jobs-tick`; dual-path API (uploads уже на Next).

## Готово (2026-08-23)

- `smoke:chain-llm` — `local|s3` + poll pending.
- Кабинет: фазы create, баннер pending/enriched, poll открытого заказа.
- `compressImageForUpload` на client/broker upload.
- Unit: `compress-image-client.test.ts`.
