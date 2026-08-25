# План: работоспособность LBM вне структуры taurus

**Статус:** проверка **done** (2026-08-25) · ужесточение **zero coupling** — [`plan-zero-llm-coupling.md`](./plan-zero-llm-coupling.md).  
Канон: ADR **D36** · [`environments.md`](./environments.md) · [`current-app.md`](./current-app.md) · [`staging.md`](./staging.md).

## Идея

Продукт LBM живёт **без** sibling `taurus/llm` / `../llm` **и без** связки с nested `./llm` (не sync, не corpus default, не build context).

## Вердикт

| Слой | Нужен taurus / nested `./llm`? | Факт |
|------|-------------------------------|------|
| Prod MVP | **Нет** | `smoke:mvp` #47935 · `smoke:payments` |
| Unit / structure | **Нет** | `test:ci`; structure требует LBM-owned README + retired sync |
| `LLM_SERVICE_URL` / OCR | Opt-in HTTP only | fail-open |
| Nested `./llm` в git | Out of bounds | tooling не читает; `sync:ai-matrix` retired |
| Corpus Compose | LBM path | `containers/llm/data/tnved/normalized` |

**LBM автономен:** MVP/CI/Compose defaults не зависят от nested llm или taurus.
