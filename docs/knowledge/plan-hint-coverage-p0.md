# Plan: Hint coverage P0–P4

**Дата:** 2026-08-31. **D33.**  
**Статус:** **P0–P3 done** (#43/#44) · **P4 in progress** (this PR).  
**Канон:** coverage probes · [`plan-hint-chains-precision-audit.md`](./plan-hint-chains-precision-audit.md).

## Сделано

| Phase | Content |
|-------|---------|
| **P0** | WRONG: apparel attr · plant dairy · mouse≠PC |
| **P1** | Triggers: овощи · сапоги · свитер · power bank · сметана · системный блок |
| **P2** | Packs: `fruit-fresh` · `woven-apparel` · `prepared-food` (+ juice/soup guards) |
| **P3** | Packs: `art` · `bags` · `watches` · `beverages` · `speakers` · `furniture` · `tires` · `cycles` |
| **P4** | Packs: `pharma` · `books` · `appliances` · `lamps` · `fasteners` · `paint` · `pet-food` · `agri-inputs` |

## P4 — open sections after P3 (C8)

| Pack | HS focus | Triggers (RU stems) |
|------|----------|---------------------|
| `pharma` | 3004 / 2106 | лекарств, витамин, таблетк, БАД |
| `books` | 4901 / 4820 | книга, тетрад, учебник, журнал |
| `appliances` | 8508 / 8450 / 8418 / 8516 | пылесос, стиральн, холодильник, фен, утюг |
| `lamps` | 9405 | лампа, светильник, люстра, торшер (LED → `led`) |
| `fasteners` | 7317 / 7318 | гвозд, шуруп, болт, гайк |
| `paint` | 3208 / 4814 | краска, обои |
| `pet-food` | 2309 | корм для … (live `кот`/`собака` = POLICY/null) |
| `agri-inputs` | 1209 / 31 / 3808 | семена, удобрен, гербицид |

### Acceptance

- Pack count **25 → 33**; fixture ≥3 positive / ≥5 mustNot per pack.
- Unit `hint-coverage-p4.test.ts`; regressions: notebook→computers, картина→art, LED→led; кот/собака null.
- `npm run test:ci` green; post-cycle re-probe for newer open sections.

## C8 — Post-cycle re-probe (after P3) — closed by P4

Closed: pharma / books / appliances / lighting-ex-led / hardware / paint / pet-food / agri.  
**Still POLICY:** pets-live (`кот`, `собака`).

## Проверка

```bash
npx vitest run src/lib/ved/__tests__/hint-coverage-p*.test.ts
npm run test:hint-precision
npm run test:ci
```

Agent cannot merge.
