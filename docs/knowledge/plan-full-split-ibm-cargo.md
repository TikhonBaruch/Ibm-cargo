# План: полное отделение ibm-cargo + max standalone

**Статус:** **done** (2026-08-25).  
Канон: D36 · [`plan-zero-llm-coupling.md`](./plan-zero-llm-coupling.md) · [`plan-autonomy-outside-taurus.md`](./plan-autonomy-outside-taurus.md).

## Идея

1. **Полностью отделить** проекты: убрать nested `./llm` из git ibm-cargo; gitignore; workspace/README без матрицы.  
2. **Максимально работоспособный** LBM: Mode A (dev+seed) + Vercel MVP smoke — канон; AI = `containers/{llm,ocr}` / Vercel mesh / heuristic.

## Сделано

| # | Что | Результат |
|---|-----|-----------|
| 1 | `git rm -r llm/` + `.gitignore` `/llm/` | дерево не в репо |
| 2 | workspace / FORK / README / KB links | нет path к nested llm |
| 3 | Structure: tracked `llm/` запрещён | gate |
| 4 | Chains канон → `src/lib/ved/chains/` | docs |
| 5 | `test:ci` + smoke | verify |

## Standalone readiness

- Mode A: `cp .env.example .env` → `npm ci` → `prisma db push/seed` → `npm run dev`
- Live MVP: `smoke:mvp` / `smoke:payments` без матрицы
- Opt-in AI: `containers/{llm,ocr}` или Vercel provider keys
- Не блокер MVP: Track A Resend/ЮKassa; Growth shipping/LLM-CTA
