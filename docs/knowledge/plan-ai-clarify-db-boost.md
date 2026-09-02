# План: ускорение ИИ-уточнения заявки через БД (Clar-DB)

**Дата:** 2026-09-02. **D33.**  
**Статус:** **done** (this PR).  
Канон: [`data-model.md`](./data-model.md) §2 · [`plan-precedent-bulk.md`](./plan-precedent-bulk.md) · [`plan-tnved-demo-corpus.md`](./plan-tnved-demo-corpus.md) · [`plan-llm-fill-hints.md`](./plan-llm-fill-hints.md) · [`customs-payments.md`](./customs-payments.md) · residual audit в [`plan-hint-coverage-expansion.md`](./plan-hint-coverage-expansion.md).

## 1. Идея

Ускорить offline-путь create/clarify для спорных семей (**погрузчик ≠ АКБ**, утильсбор vs экосбор) за счёт данных в Postgres и согласованных hint/attrs — **без** ставок утильсбора и без CTA Growth.

Цепочка: клиент пишет название → pack/attrs уточняют ветку → search по `TnvedCode.notes` → precedent hit → LLM реже.

## 2. Анализ (as-is)

| Есть | Gap |
|------|-----|
| Layer G: `8427` → `utilSborPossible`; `8506/8507` → экосбор | не в БД (правильно) |
| demo-pack: листья 8507…, notes «аккумулятор» | **нет** 8427 / погрузчик |
| pack `batteries` | STEAL: «погрузчик с аккумулятором» → 8507 |
| `verified_determinations` на approve | seed **не** кладёт демо-пары forklift≠AKB |
| `attrs.extra` (garmentType, color…) | нет `powerSource` в fingerprint |

## 3. Структура (фазы)

| ID | Содержание | Done when |
|----|------------|-----------|
| **Clar-DB-1** | demo-pack: дерево **8427** (электро / прочий погрузчик) + notes; enrich 8507 notes (тяговый АКБ; не путать с машиной) | seed upsert; search «погрузчик» / «литий-ион» |
| **Clar-DB-2** | hint pack `forklift-trucks` + guard `isForkliftMachineQuery` → skip `batteries` | unit: машина≠batteries; АКБ для погрузчика → batteries |
| **Clar-DB-3** | attr RULES + `extra.powerSource` в `buildCanonicalText` | chips/attrs; fingerprint различает ветки |
| **Clar-DB-4** | seed 2–4 `verified_determinations` (BROKER) forklift vs Li-ion AKB | `findBestPrecedent` hit без LLM на seed-текстах |
| **Clar-DB-5** | KB + README + тесты | `test:ci` / hint + precedent + demo-pack unit |

**Не делать:** ставки утильсбора в `TnvedDutyRate`; колонка `utilSborPossible` в Prisma; LLM CTA; manufacturer_skus bulk (Could, hold).

## 4. Контракт / зона

- Зона: **3 Ядро** (`src/lib/ved`, `prisma/seed`, `scripts/fixtures/tnved`).
- HTTP shape не меняется; dual-path не трогаем.
- D15: attrs только fill-empty / chips; не silent overwrite.
- D27: утильсбор остаётся trigger на карточке (Layer G), не смета.

## 5. Проверка

```bash
npx vitest run src/lib/ved/__tests__/ai-clarify-db-boost.test.ts \
  src/lib/ved/__tests__/verified-determinations.test.ts \
  src/lib/ved/__tests__/tnved-hint-trees.test.ts
npm run test:ci
```

Ручной (после seed): search «погрузчик» → 8427…; «тяговый литий-ионный» → 8507…; create с seed-текстом → precedent-v1.

## 6. Статус реализации

| Срез | Status |
|------|--------|
| Clar-DB-1 demo-pack 8427 + notes | **done** |
| Clar-DB-2 pack + guard | **done** |
| Clar-DB-3 attrs / fingerprint | **done** |
| Clar-DB-4 seed precedents | **done** |
| Clar-DB-5 KB + tests | **done** |
| manufacturer_skus for repeat SKUs | hold |
| Live H5–H7 / deploy seed на prod DB | ops после merge |
