# План: LLM на этапах заполнения + удачные прецеденты брокеру

**Дата:** 2026-08-20. **D33.**  
Канон: [`feature-cycle.md`](./feature-cycle.md) · [`calculation-fields.md`](./calculation-fields.md) · [`plan-newcalc-hints.md`](./plan-newcalc-hints.md) · [`plan-ai-mesh.md`](./plan-ai-mesh.md) срез 0 · [`plan-precedent-bulk.md`](./plan-precedent-bulk.md) · [`plan-broker-qc-loop.md`](./plan-broker-qc-loop.md).

## Идея

Клиент пишет «майка» — система предлагает состав / материал / назначение / цвет / возраст в **те же поля формы**, не новым визардом. После черновика ТН ВЭД — иконка 👍/👎. Удачные ответы копятся в `verified_determinations.quality`, не новой колонке заявки. Брокер при расхождении LLM видит похожие утверждённые кейсы.

## Анализ (as-is)

| Есть | Нет |
|------|-----|
| NewCalc fields: brand, material, origin, netWeight, hsHint | composition / purpose / color / age на create |
| Heuristic HS top-3 | Suggest attrs по названию |
| 👍/👎 только на `DONE` | Реакция на черновик HS (`AI_READY+`) |
| Precedent write-back на approve (`quality=BROKER`) | Вес `CLIENT_HELPFUL`; показ брокеру в mapping |

UI не зовёт модель. Suggest — session POST → domain (heuristic всегда; classify HS fail-open). Клиент **принимает чипами**, автозалив нет (D15).

## Структура

1. **S1** Domain `attr-suggest` + unit (heuristic «майка» и соседние классы).
2. **S2** `POST /api/v1/calculations/attr-suggest` + dual-path + contract.
3. **S3** NewCalc: composition / purpose / extra.color / extra.ageGroup + chips.
4. **S4** Feedback с `AI_READY` (есть HS); 👍 + approve → `quality=CLIENT_HELPFUL`.
5. **S5** Broker: `similarPrecedents` на карточке, если HS AI ≠ прецедент.

Hold: параллельный multi-LLM router (D30); hard-reject attrs; wizard; live LLM JSON-extract attrs / classify overlay на chips.

## Реализация (2026-08-20)

| Срез | Статус |
|------|--------|
| S1 domain + unit | **done** — `attr-suggest.ts` |
| S2 API/contract/dual-path | **done** — `POST …/attr-suggest`, `d-attr.suggest.json` |
| S3 NewCalc chips + поля | **done** — composition / purpose / extra.color / extra.ageGroup |
| S4 feedback `AI_READY` | **done** — 👍 → `CLIENT_HELPFUL` на approve |
| S5 broker similar | **done** — `BrokerSimilarPrecedents` на WorkMapping |

## Проверка

Unit: attr-suggest, feedback AI_READY, similarPrecedents prefer HELPFUL.  
Ручной: «майка» → чипы → принять → HS → 👍 после create.

## Готово (Hobby) — 2026-08-20

На `main` / prod (`0bedce7` + cabinets merge `21b05c4`). `POST /api/v1/calculations/attr-suggest` live (session). Quick-calc без laptop placeholder.
