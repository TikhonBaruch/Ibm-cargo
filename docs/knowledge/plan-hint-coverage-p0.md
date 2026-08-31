# Plan: Hint coverage P0–P1 — WRONG fixes + trigger gaps

**Дата:** 2026-08-31. **D33.**  
**Статус:** **P0+P1 done** (this PR) · post-cycle re-probe: 0 new WRONG; open sections listed §C6.  
**Канон:** coverage probes waves 1–6 · [`plan-hint-chains-precision-audit.md`](./plan-hint-chains-precision-audit.md) · D15 / D27.

## Идея

После матрицы запросов зафиксированы **WRONG** (чинить) и **GAP** (triggers).

### P0 — WRONG

1. **Attr apparel** — 6203 42 на куртка/платье → split jeans/jacket/dress.  
2. **Plant dairy** — растительные молоко/йогурт ≠ milk/040x.  
3. **Mouse≠PC** — мышь компьютерная ≠ computers/8471.

### P1 — trigger GAP (высокий трафик)

| Pack | Добавить triggers |
|------|-------------------|
| produce-fresh | овощ, чеснок, зелень, укроп, петрушк |
| footwear | сапог, босонож, тапк, тапоч, сланц, кросовк |
| knit-top | свитер, свитшот, джемпер, кардиган, водолазк, кофт, олимпийк |
| power | power bank, power-bank, внешний аккумулятор, зарядн |
| milk | сметан, ряженк, масло сливоч |

## Фазы

| ID | Что | Status |
|----|-----|--------|
| **C0** | План | done |
| **C1–C4** | P0 WRONG + unit | done |
| **C5** | P1 triggers + unit/fixture | done |
| **C6** | Post-cycle re-probe → new test sections? | done (§C6) |

## Non-goals

- Packs фрукты/супы/тканая одежда (P2).  
- P7 short-trigger (#42) merge.  

## Проверка

```bash
npx vitest run src/lib/ved/__tests__/hint-coverage-p0.test.ts src/lib/ved/__tests__/hint-coverage-p1.test.ts
npm run test:hint-precision
npm run test:ci
```

## C6 — Post-cycle re-probe (2026-08-31)

После P0+P1: **0 NEW WRONG** на regression matrix.

### Дополнительные разделы для тестирования (ещё нет C21 pack)

| Секция | Примеры | Приоритет |
|--------|---------|-----------|
| **fruit-08** | фрукты, ягоды, яблоко | P2 |
| **woven-62 / pants-62** | рубашка, брюки | P2 |
| **prepared-21** | суп | P2 |
| **art-97** | картина | Could |
| **bags-42** | сумка | Could |
| **watches-91** | часы | Could |
| **bev-22** | пиво | Could |
| **audio-8518** | колонка bluetooth | Could |
| **input peripherals** | мышь logitech (не PC) | attr later |

P1 also closed `системный блок` → computers (trigger fix).

Agent cannot merge.

