# План: остановка worker — clearInterval + in-flight logistics

Индекс: [`testing.md`](./testing.md) · [`testing-branches.md`](./testing-branches.md).  
Ветвь 3 (ядро / orch). D26. Без shipping UI (D27 hold).

## 1. Идея

Compose `containers/worker` крутит `setInterval` (SLA / AI drain) **без** `clearInterval` и без SIGTERM. Нужен останавливаемый цикл: таймеры снимаются, текущий tick логистики **дожидается**, новые тики не стартуют.

## 2. Анализ

| Есть | Нет |
|------|-----|
| `containers/worker/src/index.js` — `setInterval` fire-and-forget | `stopWorker`, SIGTERM/SIGINT |
| `jobs-tick.ts` — один прогон cron | учёт in-flight |
| Unit `jobs-tick.test.ts` | тест «stop чистит interval + ждёт logistics» |

Файла `worker.ts` не было. Jest не добавляем (Vitest).

## 3. Структурирование

### E1 — `src/lib/ved/worker.ts`

`startWorker` / `stopWorker`: по одному `setInterval` на tick (`sla`, `logistics`, `aiDrain`). `stopWorker` → `clearInterval` всех id, `stopped=true`, `await Promise.allSettled(inFlight)`.

### E2 — unit

`worker.test.ts`: fake timers + spy `clearInterval`; in-flight logistics не обрывается; SIGTERM зовёт stop.

### E3 — Compose worker

`index.js`: те же правила (таймеры в массив, SIGTERM/SIGINT → stop + `server.close`). Новый HTTP logistics tick **не** добавляем.

### Hold

Jest как второй runner; live LOGISTICS_TRACK HTTP в worker.

## 4. Реализация

| Фаза | Статус |
|------|--------|
| План | **done** |
| E1–E2 | **done** |
| E3 | **done** |
| Hold | hold |

## 5. Проверка

`npx vitest run src/lib/ved/__tests__/worker.test.ts`

## 6. Деплой

Код + KB. Migrate нет. Hobby cron (`jobs-tick`) без интервалов — не ломаем.
