# План: UX Sprint 1–2 (замыкание петель кабинетов)

Индекс: [`cabinets/ui-guide.md`](./cabinets/ui-guide.md) · canvas cabinets-ux-completeness · D32/D33.  
Не трогать: shipping CTA, LLM CTA, ЮKassa, Cmd+K, unclaim domain.

## Sprint 1 — замкнуть петли

| # | Кабинет | Что |
|---|---------|-----|
| 1 | Производитель | Onboarding checklist на дашборде; empty demand/pools с CTA publish; copy после CONFIRMED; nav badge SUBMITTED |
| 2 | Брокер | Chat-first: выбор треда остаётся на `/chat?id=`; WorkChat выше; без полного WorkMapping сверху |
| 3 | Клиент | First-run чеклист на дашборде при `calcs.length === 0` |

## Sprint 2 — плотность ops

| # | Кабинет | Что |
|---|---------|-----|
| 4 | Админ | После approve manufacturer → toast + CTA Users; integrations actionable empty |
| 5 | Клиент | waitingOn на дашборде; статус PENDING у manufacturerName |
| 6 | Брокер | Preview перед approve; inbox waitingOn на дашборде |

## Проверка

`npm run test:ci` после каждого спринта; ручной smoke: manufacturer empty → publish; broker /chat select stays; client empty dash checklist.

## Статус

| Фаза | Статус |
|------|--------|
| План | **done** |
| Sprint 1 | **done** |
| Sprint 2 | **done** — admin handoff/integrations; client waitingOn + PENDING mfg; broker approve preview + chat inbox |
