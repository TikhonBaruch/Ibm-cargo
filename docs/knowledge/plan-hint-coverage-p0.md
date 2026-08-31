# Plan: Hint coverage P0 — attr apparel + plant dairy + mouse≠PC

**Дата:** 2026-08-31. **D33.**  
**Статус:** **implementing done** — ready for human merge.  
**Канон:** coverage probes waves 1–6 · [`plan-hint-chains-precision-audit.md`](./plan-hint-chains-precision-audit.md) · D15 / D27.

## Идея

После матрицы запросов (картины→обувь→мышь) зафиксированы **3 класса WRONG**, не GAP:

1. **Attr apparel** — RULE `apparel` вешает **6203 42** (джинсы) на куртка/платье.  
2. **Plant dairy** — `* молоко` / соевый йогурт → pack `milk` + attr/alias **040x**.  
3. **Mouse≠PC** — «мышь компьютерная» → pack `computers` + attr ноутбук **8471** (триггер/regex `компьютер`).

## Анализ

| Слой | Баг | Корневая причина |
|------|-----|------------------|
| attr-suggest | куртка/платье → 6203 42 | один RULE на куртк\|брюк\|плать\|джинс |
| attr + pack milk | соевое молоко | trigger/regex `молок` без plant-denylist |
| pack computers + attr laptop | компьютерная мышь | substring `компьютер` ⊂ `компьютерная` |

## Фазы

| ID | Что | Done when |
|----|-----|-----------|
| **C0** | Этот план + KB index | merged docs |
| **C1** | Split apparel attr (jeans / jacket / dress) | unit: куртка/платье ≠ 6203 42 |
| **C2** | Plant-dairy guard (pack + attr) | соя/овсянка/миндаль/кокос/рис молоко\|йогурт ≠ milk |
| **C3** | Mouse≠PC guard (pack + attr laptop) | мышь компьютерная ≠ computers/8471 |
| **C4** | Fixture/unit + `test:ci` | green |

## Non-goals

- Новые C21 packs (фрукты, супы, брюки) — P2 backlog.  
- P7 short-trigger PR (#42) — отдельный merge.  
- LLM CTA.

## Проверка

```bash
npx vitest run src/lib/ved/__tests__/hint-coverage-p0.test.ts
npm run test:hint-precision
npm run test:ci
```

Agent cannot merge.