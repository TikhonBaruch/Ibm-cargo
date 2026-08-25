# @kargo/llm-matrix

**LLM-матрица** сервисов для **ibm-cargo** (приложение в корне репозитория).  
Шесть модулей лендинга — отдельные HTTP-сервисы с frozen contracts; app остаётся оркестратором просчёта/оплаты/брокера.

| Сервис | Порт | App env |
|--------|------|---------|
| classification | 4500 | `LLM_SERVICE_URL` |
| ocr | 4700 | `OCR_SERVICE_URL` |
| logistics | 4601 | future `LOGISTICS_AI_SERVICE_URL` |
| documents | 4750 | future `DOCUMENTS_SERVICE_URL` |
| broker | 4800 | future `AI_BROKER_SERVICE_URL` |
| risk | 4900 | future `RISK_SERVICE_URL` |

Документы: [`docs/matrix.md`](docs/matrix.md) · [`docs/integration.md`](docs/integration.md) · [`docs/vision.md`](docs/vision.md).

## Quickstart

```bash
cp .env.example .env
npm install
PORT=4500 npm run start:classification
PORT=4700 npm run start:ocr
# или: docker compose up --build
npm run smoke
```

Подключение к локальному app (корень репо):

```bash
LLM_SERVICE_URL=http://127.0.0.1:4500
OCR_SERVICE_URL=http://127.0.0.1:4700
```

## Правила

См. [`AGENTS.md`](AGENTS.md). Не дублировать D8 FSM. Fail-open. UI не вызывает матрицу напрямую.

## Корпус ТН ВЭД

[`docs/sources-tnved.md`](docs/sources-tnved.md) · [`data/tnved/`](data/tnved/).

```bash
npm run tnved:corpus
```
