# План: DB-интеграционные тесты D-SHIP

Индекс: [`testing.md`](./testing.md) · [`testing-branches.md`](./testing-branches.md) · [`db-process.md`](./db-process.md).  
Ветвь 3 (ядро). D15 / D23 / D33. Без shipping UI (D27 hold).

## 1. Идея

Покрыть **живой PrismaClient** сценарий D-SHIP: после `Calculation.status = DONE` создаётся `ShippingRequest` (путевой лист), статус `QUOTED`, дальше трекинг `IN_TRANSIT` → `DELIVERED`. Unit с моком Prisma этот путь не доказывает.

## 2. Анализ (as-is)

| Есть | Нет |
|------|-----|
| Unit `logistics.test.ts` (fetch/stub, без БД) | Writer `ShippingRequest` вынесен из route |
| `smoke:shipping` / e2e — HTTP pre-DONE 400 | Opt-in suite на локальном Postgres |
| Моки Prisma в `calculations.test.ts` | Очистка фикстур / изоляция тестов |

Файла `logistics.service.ts` нет (Nest не используем). Writer живёт в `app/api/v1/shipping/route.ts` + зеркало `containers/api`.

Раннер репозитория — **Vitest** (API как у Jest: `describe` / `it` / `expect` / `beforeAll`). Второй раннер Jest не добавляем.

## 3. Структурирование

### E1 — domain writer

`src/lib/ved/shipping.ts`: `createShippingRequest(db, …)` + `applyShippingTracking(db, row, track)`.  
Next `POST/GET /api/v1/shipping` вызывает writer. Поведение HTTP не меняем. `containers/api` зеркало не трогаем в этом срезе (shape/errors те же).

### E2 — тестовый PrismaClient

`src/lib/ved/__tests__/helpers/prisma-test.ts`: отдельный `PrismaClient` на `TEST_DATABASE_URL` или локальный `DATABASE_URL`.  
Отказ, если URL не localhost / `127.0.0.1` / `postgres` (не sweb/prod).

### E3 — сценарий + изоляция

Фикстуры с уникальным префиксом (`itest-ship-*`). `afterEach`: delete shipping → calculation → user → company. Без `TRUNCATE` (seed не трогаем).

Сценарий: DONE → создать заявку (`QUOTED` + `trackingCode` + quotes) → IN_TRANSIT → DELIVERED; pre-DONE → ошибка D15.

### E4 — hold

- Jest как второй test runner
- `test:ci` ходит в БД
- TRUNCATE / вторая prod `DATABASE_URL`
- Nest `logistics.service.ts`

## 4. Реализация

| Фаза | Статус |
|------|--------|
| План | **done** |
| E1 writer + route | **done** — `shipping.ts` |
| E2–E3 tests | **done** — `shipping.integration.test.ts`, `npm run test:integration` |
| E4 | hold |

## 5. Проверка

- `npm run test:ci` — integration **не** в unit (exclude `*.integration.test.ts`).
- `RUN_DB_INTEGRATION=1 npm run test:integration` — локальный Postgres (`postgresql://lbm:lbm@127.0.0.1:5432/lbm`).
- Без флага / без локальной БД — skip, не fail CI.

## 6. Деплой

Код + KB. Migrate не требуется. Hobby не обязан гонять DB-suite.
