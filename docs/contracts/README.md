# docs/contracts — envelopes ядра

Индекс форматов диалогов для параллельной разработки контейнеров.  
Сценарии: [`../knowledge/core-dialogues.md`](../knowledge/core-dialogues.md).  
Единая KB: [`../knowledge/README.md`](../knowledge/README.md).

Каждый файл — **один** независимо версионируемый контракт (JSON Schema draft-07 + `examples`).  
Менять файл может только команда контейнера-владельца; breaking change = bump `x-contractVersion`.

| Envelope | Файл | Владелец | Участники |
|----------|------|----------|-----------|
| D-DRAFT (ai) | [`d-draft.ai.json`](./d-draft.ai.json) | `containers/ai` | api ↔ ai |
| D-DRAFT (llm) | [`d-draft.llm.json`](./d-draft.llm.json) | `containers/llm` | ai ↔ llm |
| D-CALC | [`d-calc.client.json`](./d-calc.client.json) | `containers/api` | client → core |
| D-QUEUE | [`d-queue.broker.json`](./d-queue.broker.json) | `containers/api` | broker → core |
| D-MAP | [`d-map.broker.json`](./d-map.broker.json) | `containers/api` | broker → core |
| D-THREAD | [`d-thread.chat.json`](./d-thread.chat.json) | `containers/api` | client ↔ broker via core |
| D-LEDGER | [`d-ledger.json`](./d-ledger.json) | `containers/api` + `payments` | pay / topup / webhook |
| D-EVENT | [`d-event.notify.json`](./d-event.notify.json) | `containers/notify` | core → notify |
| D-JOB | [`d-job.worker.json`](./d-job.worker.json) | `containers/worker` | worker → core |
| D-SHIP | [`d-ship.logistics.json`](./d-ship.logistics.json) | `containers/logistics` | core → logistics |
| D-PRODUCT | [`d-product.calc.json`](./d-product.calc.json) | `containers/api` | client → core (item attrs) |
| D-TNVED | [`d-tnved.core.json`](./d-tnved.core.json) | `containers/api` | lookup / import TN VED |
| D-HISTORY | [`d-history.calc.json`](./d-history.calc.json) | `containers/api` | calc event trail |
| D-ORCH | [`d-orch.core.json`](./d-orch.core.json) | `containers/api` | BackgroundJob / ServiceOutbox / ServiceCall (D26) |
| D-OCR | [`d-ocr.ai.json`](./d-ocr.ai.json) | `containers/ocr` | optional extract → attrs (P2 scaffold) |
| D-SKU | [`d-sku.manufacturer.json`](./d-sku.manufacturer.json) | `containers/api` | manufacturer catalog (D31) |
| D-SKU catalog | [`d-sku.catalog.json`](./d-sku.catalog.json) | `containers/api` | CLIENT pick PUBLISHED SKU (C2) |
| D-ORDER | [`d-order.consolidate.json`](./d-order.consolidate.json) | `containers/api` | factory request → сборный заказ (D34) |
| D-MANUFACTURER directory | [`d-manufacturer.directory.json`](./d-manufacturer.directory.json) | `containers/api` | propose + ADMIN approve directory |
| D-ADMIN actors | [`d-admin.actors.json`](./d-admin.actors.json) | `containers/api` | ADMIN company/broker cards |
| D-ATTR suggest | [`d-attr.suggest.json`](./d-attr.suggest.json) | `containers/api` | client fill-stage attr chips |
| D-AI pipeline | [`d-ai.pipeline.json`](./d-ai.pipeline.json) | `containers/api` | Qwen describe/reset → DeepSeek classify (`AI_DRAIN`) |

## Правила

1. UI не импортирует эти схемы в runtime обязательным образом — сначала документация/CI drift checks.
2. Запреты D11/D15 см. core-dialogues.
3. Следующий шаг (не сейчас): `packages/ved-contracts` из этих JSON.
