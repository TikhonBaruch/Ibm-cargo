# План: работоспособность LBM вне структуры taurus

**Статус:** проверка **done** (2026-08-25).  
Канон: ADR **D36** · [`environments.md`](./environments.md) · [`current-app.md`](./current-app.md) · [`staging.md`](./staging.md).

## Идея

Убедиться, что продукт LBM (ibm-cargo) **живёт без** sibling `taurus/llm` / `../llm`: MVP D27 не требует матрицы как runtime-зависимости, а правки LBM/DB не трогают taurus (D36).

## Анализ

| Слой | Нужен taurus/sibling `../llm`? | Факт |
|------|-------------------------------|------|
| Prod MVP (heuristic → pay → broker → DONE) | **Нет** | Live `smoke:mvp` / `smoke:payments` на https://taurus-liart.vercel.app |
| Unit / structure / contracts | **Нет** sibling; structure читает `containers/llm/README` (зеркало LBM) | `npm run test:ci` PASS |
| `LLM_SERVICE_URL` / `OCR_SERVICE_URL` | Opt-in HTTP | `llm-enrich` fail-open без URL |
| Nested `llm/` в репо | Sync-источник / docs / corpus scripts | Не npm-зависимость Next; не sibling taurus |
| Compose `scale`/`full` | Опционально mount корпуса | Growth / mesh, не блокер D27 |
| Agent VM (эта проверка) | Нет Docker / `.env` | Mode A local не гоняли; критерий = CI + live smoke |

## Структура проверки

1. Карта deps (runtime vs sync) — **done**.
2. `npm run test:ci` без sibling `../llm` — **done** (508 unit + structure + contracts + verify).
3. Live spine без записи в taurus/llm — **done** (`smoke:mvp` #47935, `smoke:payments`).
4. Запись в KB — **этот файл** + строки в staging / current-app.

## Вердикт

**LBM работоспособен вне структуры taurus:** MVP и CI не зависят от sibling matrix; матрица — opt-in HTTP или sync → `containers/{llm,ocr}`.

**Не блокер MVP:** `npm run sync:ai-matrix:check` — drift `classification→llm: src/tnved-lookup.js` (гигиена зеркала; не запускать sync с записью в taurus/llm).

## Не делали (и не нужно для вердикта)

- Локальный `npm run dev` в этой VM (нет `.env` / Docker).
- Compose profile `scale` с mount `../llm/data/...`.
- Авто-`sync:ai-matrix` (пишет только в mirrors; drift оставляем до явной задачи на зеркало).
