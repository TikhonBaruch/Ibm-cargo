# Plan: Hint coverage P0–P3

**Дата:** 2026-08-31. **D33.**  
**Статус:** **P0–P3 done** (PR #43) · post-cycle §C8.  
**Канон:** coverage probes · [`plan-hint-chains-precision-audit.md`](./plan-hint-chains-precision-audit.md).

## Сделано

| Phase | Content |
|-------|---------|
| **P0** | WRONG: apparel attr · plant dairy · mouse≠PC |
| **P1** | Triggers: овощи · сапоги · свитер · power bank · сметана · системный блок |
| **P2** | Packs: `fruit-fresh` · `woven-apparel` · `prepared-food` (+ juice/soup guards) |
| **P3** | Packs: `art` · `bags` · `watches` · `beverages` · `speakers` · `furniture` · `tires` · `cycles` |

## C8 — Post-cycle re-probe (after P3)

**0 NEW WRONG** on prior matrix. Closed C6/C7 open sections (art/bags/watches/bev/audio/furniture/tires/bikes).

### New open test sections (no C21 pack yet)

| Секция | Примеры |
|--------|---------|
| pharma-30 | лекарство, витамины |
| books-49 | книга, тетрадь |
| home-appliances | утюг, фен, пылесос, холодильник, стиральная машина |
| lighting-ex-led | лампа настольная (led pack covers LED only) |
| hardware-73 | гвозди, шурупы |
| paint-32 | краска, обои |
| pets-live | кот, собака (не toys) |
| agri-inputs | семена, удобрение |

## Проверка

```bash
npx vitest run src/lib/ved/__tests__/hint-coverage-p*.test.ts
npm run test:hint-precision
npm run test:ci
```

Agent cannot merge.
