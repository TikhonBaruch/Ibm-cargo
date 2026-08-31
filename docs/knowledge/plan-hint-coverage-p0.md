# Plan: Hint coverage P0–P2 — WRONG fixes + triggers + new packs

**Дата:** 2026-08-31. **D33.**  
**Статус:** **P0+P1+P2 done** (this PR) · post-cycle §C7.  
**Канон:** coverage probes · [`plan-hint-chains-precision-audit.md`](./plan-hint-chains-precision-audit.md) · D15 / D27.

## Идея

Матрица запросов → **WRONG** чинить, **GAP** закрывать triggers/packs, после каждого цикла — **новые тестовые секции**.

### P0 — WRONG
apparel attr split · plant dairy · mouse≠PC

### P1 — triggers
овощи/чеснок/зелень · сапоги/кросовки · свитер · power bank · сметана · системный блок

### P2 — new C21 packs
| Pack | Глава | Guards |
|------|-------|--------|
| `fruit-fresh` | 08 | skip if сок/juice |
| `woven-apparel` | 62 | не bare `shirt` (polo shirt → knit) |
| `prepared-food` | 21 | skip produce if суп/борщ |

## Фазы

| ID | Status |
|----|--------|
| C0–C6 | done (P0+P1) |
| **C7** | P2 packs + re-probe | **done** |

## C7 — Post-cycle re-probe (after P2)

**0 NEW WRONG** on regression.

### Closed by P2
fruit-08 · woven-62 / pants-62 · prepared-21

### Still open (next packs / Could)
| Секция | Примеры |
|--------|---------|
| art-97 | картина |
| bags-42 | сумка, рюкзак |
| watches-91 | часы |
| bev-22 | пиво |
| audio-8518 | колонка |
| furniture-94 | мебель |
| tires-40 | шина |
| vehicles-87 | велосипед |

## Проверка

```bash
npx vitest run src/lib/ved/__tests__/hint-coverage-p*.test.ts
npm run test:hint-precision
npm run test:ci
```

Agent cannot merge.
