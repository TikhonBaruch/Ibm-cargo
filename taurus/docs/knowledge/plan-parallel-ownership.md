# План: параллельная ownership + multi-model (без контейнера на vendor)

**Дата:** 2026-08-21.  
**Цикл D33.** Канон: [`feature-cycle.md`](./feature-cycle.md) · [`containerization.md`](./containerization.md) · [`branches.md`](./branches.md) · ADR D19 / D21 / D30.

## Идея

Зафиксировать границы пакетов для параллельной разработки (UI / domain / orch / AI-матрица) и правило: **новая модель = профиль/цепочка за envelope, не новый Docker-сервис**.

## Анализ

As-is: 14+ контейнеров и dual-path (Vercel Prisma-in-Next vs Compose `USE_DOMAIN_API`).  
AI-логика размазана: `src/lib/ved/provider-mesh*` (Vercel), `containers/llm|ocr` (Compose mirror), канон capability — репо **`/home/andrey/llm`**.  
Антипаттерн D19 уже запрещает дробить infra; не хватало явной таблицы «кто трогает какие файлы» и канона sync mirror.

## Структура (этот цикл)

| # | Что | Критерий done |
|---|-----|----------------|
| 1 | Ownership table + multi-model rules в KB / `ved-ownership.mdc` | агенты видят пакеты |
| 2 | `src/lib/ved/PACKAGES.md` — logical domain/orch/mesh (без массового move) | карта файлов |
| 3 | Canon: `llm` repo → compose mirror; override context + sync script | один источник classify/ocr |
| 4 | Structure gate + ссылки в README / containerization / llm AGENTS | `test:structure` зелёный |

**Не в этом цикле:** C5 slim cutover, полный Domain API на Vercel, новый capability-сервис (risk/documents).

## Жёсткие рамки

1. D27 MVP не ломать.  
2. Не контейнер на DeepSeek/Qwen/… — только profile + `LLM_CLASSIFY_CHAIN`.  
3. UI без Prisma. UI не зовёт matrix URL.  
4. Envelope sync: `llm/contracts` ↔ `taurus/docs/contracts`.  
5. Fail-open create.

## Проверка

- `npm run test:structure`  
- `npm run sync:ai-matrix:check` (если есть sibling `../llm`)  
- Unit mesh/failover без регресса (уже зелёные).
