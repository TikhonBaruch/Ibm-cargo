# @kargo/llm-matrix

Внешняя **LLM-матрица** сервисов для [Taurus](../taurus) (Карго Брокер).  
Шесть модулей лендинга — как отдельные HTTP-сервисы с frozen contracts; Taurus остаётся оркестратором просчёта/оплаты/брокера.

| Сервис | Порт | Taurus env |
|--------|------|------------|
| classification | 4500 | `LLM_SERVICE_URL` |
| ocr | 4700 | `OCR_SERVICE_URL` |
| logistics | 4601 | future `LOGISTICS_AI_SERVICE_URL` |
| documents | 4750 | future `DOCUMENTS_SERVICE_URL` |
| broker | 4800 | future `AI_BROKER_SERVICE_URL` |
| risk | 4900 | future `RISK_SERVICE_URL` |

Документы: [`docs/matrix.md`](docs/matrix.md) · [`docs/integration-taurus.md`](docs/integration-taurus.md) · [`docs/vision.md`](docs/vision.md).

## Quickstart

```bash
cp .env.example .env
npm install
# без Docker — по одному:
PORT=4500 npm run start:classification
PORT=4700 npm run start:ocr
# или всё:
docker compose up --build
npm run smoke
```

Если рядом крутится Taurus Compose (`llm:4500` / `ocr:4700`), поднимите матрицу на других портах и передайте URL в smoke:

```bash
PORT=14500 npm run start:classification
CLASSIFICATION_URL=http://127.0.0.1:14500 npm run smoke
```

Подключение к локальному Taurus:

```bash
# в env Taurus / Next
LLM_SERVICE_URL=http://127.0.0.1:4500
OCR_SERVICE_URL=http://127.0.0.1:4700
```

## Правила

См. [`AGENTS.md`](AGENTS.md). Не дублировать D8 FSM. Fail-open. UI Taurus не вызывает матрицу напрямую.

## Источники

Скопировано из Taurus (as-is classify/OCR + adapters): [`docs/sources.md`](docs/sources.md).

## Корпус ТН ВЭД / Пояснений

Эталон кодов/ставок: **ЕЭК НСИ + ЕТТ + ФТС opendata** — [`docs/sources-tnved.md`](docs/sources-tnved.md) · [`data/tnved/`](data/tnved/).

```bash
npm run tnved:corpus
# notes (Пояснения): npm run tnved:fetch-psn && npm run tnved:normalize
```

## Инкотермс / комментарии

Инвентарь источников (Guide ICC, 723, свободный слой) — [`docs/sources-incoterms.md`](docs/sources-incoterms.md).  
Канон в единой KB Taurus: `taurus/docs/knowledge/incoterms.md` (Growth hold, не scrape полного текста).

## Платежи (НДС / сборы)

Без KEY: [`docs/sources-payments.md`](docs/sources-payments.md) · Taurus `docs/knowledge/customs-payments.md` (НДС 22%, шкала ПП 1637).
