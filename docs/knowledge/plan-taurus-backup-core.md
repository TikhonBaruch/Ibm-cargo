# План: taurus-liart — backup ядра (read-only)

**Статус:** **always** (2026-08-25).  
ADR: **D37** · [`decisions.md`](./decisions.md).

## Идея

**https://taurus-liart.vercel.app** — зафиксированный **бекап рабочего ядра** LBM на отдельном Vercel-проекте.  
**Не** целевой prod для репозитория `TikhonBaruch/Ibm-cargo` и **не** стенд для deploy/smoke/migrate из этого git.

## Запрещено (always)

| Действие | Почему |
|----------|--------|
| Deploy / push в проект taurus | Портит frozen snapshot |
| `TEST_API_URL=…taurus…` smoke / e2e / CI по умолчанию | Пишет тестовые данные в backup DB |
| `prisma db push` / migrate «через» taurus | Меняет schema/data backup |
| Менять env Vercel проекта taurus | Операторский контур backup |
| Считать taurus «канон live» в новых PR | Устаревший ориентир |

## Разрешено

- Read-only сверка поведения (ручной просмотр UI «как было»).
- Упоминание в KB как **архив / reference**.
- D36: не трогать **файлы** taurus/llm в workspace — по-прежнему отдельно.

## Активный контур ibm-cargo (as-is)

| Среда | URL / как | Smoke / QA |
|-------|-----------|------------|
| **Preview** | Vercel project `ibm-cargo` → branch URL (SSO) | `TEST_API_URL=<preview-url> npm run smoke:*` |
| **Local / Compose** | `npm run dev` · `docker:full` → `:8080` | `smoke:gateway` · localhost |
| **Целевой prod** | VPS + `docker:full` + свой домен (Vercel временный) | после cutover |

`https://ibm-cargo.vercel.app` — **чужой** статический проект; не путать с Preview `ibm-cargo`.

## Env для Preview ibm-cargo

Зеркало Production keys на scope **Preview** (см. [`plan-preview-auth.md`](./plan-preview-auth.md) · [`deploy.md`](./deploy.md)).  
**Не** копировать origin с taurus; `NEXTAUTH_URL` на Preview — branch URL (код подставляет `VERCEL_BRANCH_URL`).

## Связь с D36

- **D36** — не coupling с taurus/**llm** tree и не shared DB с матрицей.
- **D37** — не трогать **деploy/host taurus-liart** (backup snapshot), даже если когда-то общалась БД.

## Done when

- [x] D37 в `decisions.md`
- [x] `AGENTS.md` + инварианты
- [x] smoke-примеры без default taurus
