# План: нулевая связка LBM ↔ nested `llm/` / taurus

**Статус:** **done** (2026-08-25).  
Канон: ADR **D36** · [`plan-autonomy-outside-taurus.md`](./plan-autonomy-outside-taurus.md).

## Идея

Взаимосвязей с матрицей **не должно быть вообще**: ни sibling `../llm` / taurus, ни nested `./llm` как sync-источник, corpus-mount или build context. LBM общается с AI только по **HTTP** (`*_SERVICE_URL`) или через **свой** код в `containers/{llm,ocr}` / Vercel mesh.

## Анализ (было → стало)

| Было | Стало |
|------|--------|
| `sync:ai-matrix` копирует `./llm/services/*` → mirrors | Скрипт **retired** (no-op, D36) |
| Compose `TNVED_DATA_DIR=./llm/data/...` | Default `./containers/llm/data/tnved/normalized` |
| `tnved-lookup` / start-mesh / compose-layers → `./llm` | Только LBM paths |
| D36 разрешал read→sync | D36: **только HTTP**; nested `./llm` out of bounds |
| README «mirror + sync» | `containers/{llm,ocr}` = **LBM-owned** |

Nested `./llm` в git, если лежит в репо — **чужое дерево** для LBM-задач. Удаление дерева — отдельное решение владельца; tooling не зависит.

## Done when

- [x] LBM scripts/containers не требуют `./llm`
- [x] `sync:ai-matrix[:check]` retired no-op
- [x] KB + structure gate
