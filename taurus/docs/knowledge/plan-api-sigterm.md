# План: SIGTERM graceful shutdown (containers/api)

Индекс: [`testing.md`](./testing.md) · [`plan-worker-shutdown.md`](./plan-worker-shutdown.md).  
Ветвь 3 (ядро). D26. Compose `containers/api`.

## 1. Идея

`containers/api/src/index.js` слушает HTTP и держит `PrismaClient`, но **без** SIGTERM: при `docker stop` соединения и пул Postgres не закрываются явно. Нужен handler: `server.close` → `prisma.$disconnect()` → `process.exit(0)`.

## 2. Анализ

| Есть | Нет |
|------|-----|
| Worker: SIGTERM + `server.close` (без Prisma) | Api: SIGTERM / `$disconnect` |
| Unit `worker.test.ts` | Smoke: `process.emit('SIGTERM')` → close + disconnect + exit 0 |

## 3. Структурирование

### E1 — канон `src/lib/ved/graceful-shutdown.ts`

`runGracefulShutdown` / `attachSigtermHandlers`: инъекция `server`, `prisma`, `exit`, `processRef` (для теста без убийства vitest).

### E2 — `containers/api/src/index.js`

Зеркало: SIGTERM/SIGINT → close → `$disconnect` → exit 0. Флаг `shuttingDown` против повторного входа.

### E3 — smoke

`api-sigterm.smoke.test.ts`: `process.emit('SIGTERM')` на stub-process; assert close / `$disconnect` / `exit(0)`. В `test:ci` (без живой БД).

### E4 — Dockerfile 12-Factor

`containers/api/Dockerfile`:
1. `npx prisma generate` в **build** (`RUN`), не в `CMD`
2. `CMD ["node", "src/index.js"]` — Node = PID 1, SIGTERM доходит до handler
3. non-root `appuser` + `USER appuser`

### Hold

Реальный `docker stop` smoke; вынос всего api на ESM-модуль; те же 12-Factor правки для worker/ai (отдельный срез).

## 4. Реализация

| Фаза | Статус |
|------|--------|
| План | **done** |
| E1–E3 | **done** |
| E4 Dockerfile | **done** |
| Hold | hold |

## 5. Проверка

`npx vitest run src/lib/ved/__tests__/api-sigterm.smoke.test.ts` · `npm run test:ci`  
Образ: `docker compose build api` — generate на build; `docker stop` должен доставить SIGTERM в `node`.

## 6. Деплой

Код + KB. Migrate нет. Пересобрать compose `api` после merge.
