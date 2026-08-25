# Worker — фоновые задачи

Порт: **4200**. Профили: `core`, `scale`, `full`.

Заготовки job kinds: `SLA_TICK`, `AI_DRAIN`, `LEDGER_RECONCILE`.  
Очередь сейчас in-memory; целевой брокер — `redis` (`REDIS_URL`).

Остановка: SIGTERM/SIGINT → `clearInterval` всех тиков, ждут in-flight (не abort). Канон: `src/lib/ved/worker.ts` (`stopWorker`).

```bash
curl -X POST http://localhost:4200/v1/jobs -H 'content-type: application/json' \
  -d '{"kind":"SLA_TICK","payload":{"calculationId":"demo"}}'
```
