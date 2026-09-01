# Plan: Hint coverage P0–P6

**Дата:** 2026-08-31. **D33.**  
**Статус:** **P0–P3 on main** (#43/#44) · **P4–P6** (this PR → main). **53 packs.**  
**Канон:** coverage probes · [`plan-hint-chains-precision-audit.md`](./plan-hint-chains-precision-audit.md).

## Сделано

| Phase | Content |
|-------|---------|
| **P0** | WRONG: apparel attr · plant dairy · mouse≠PC |
| **P1** | Triggers: овощи · сапоги · свитер · power bank · сметана · системный блок |
| **P2** | Packs: `fruit-fresh` · `woven-apparel` · `prepared-food` (+ juice/soup guards) |
| **P3** | Packs: `art` · `bags` · `watches` · `beverages` · `speakers` · `furniture` · `tires` · `cycles` |
| **P4** | Packs: `pharma` · `books` · `appliances` · `lamps` · `fasteners` · `paint` · `pet-food` · `agri-inputs` |
| **P5** | Expand `cosmetics` + packs `personal-care` · `baby` · `tools` · `cookware` · `tableware` · `batteries` · `networking` · `home-textiles` |
| **P6** | `rugs` · `sports` · `camping` · `umbrellas` · `optics` · `med-disposables` · `pet-accessories` · `displays` · `printers` · `peripherals` · `auto-parts` · `security-cam` + toys lego |

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

## P5 — open sections after P4 (C9)

| Pack | HS focus | Notes |
|------|----------|-------|
| `cosmetics` (expand) | 3304 / 3305 | помада, шампунь |
| `personal-care` | 3401 / 3306 | мыло, зубная паста |
| `baby` | 9619 | подгузник, памперс |
| `tools` | 8205 / 8467 | молоток, дрель |
| `cookware` | 7323 | кастрюля, сковорода |
| `tableware` | 6912 | тарелка, чашка |
| `batteries` | 8506 / 8507 | ≠ power bank |
| `networking` | 8517 | роутер |
| `home-textiles` | 9404 / 6302 | одеяло, подушка |

Pack count **33 → 41**.

## C9 — Post-cycle re-probe (after P4)

**0 NEW WRONG** on P0–P4 matrix. C8 sections closed (pharma…agri). Live animals still POLICY.

`куртка`/`платье` remain pack-null (P0 attr-path, not C21 pack) — OK.

## P6 — open sections after P5 (C10)

Pack count **41 → 53**. Bare `камера` / `фильтр` / `свеча` stay null (need qualifier). Live animals POLICY.

## C11 — Post-cycle re-probe (after P6)

C10 sections closed. Gap probe ~280 queries → ~262 null pack; 4 known WRONG (лимонад, кофемашина, автокресло, порошок).

Remaining long-tail POLICY: generic `провод`, photo cameras, candles/filters without qualifier, etc. — defer unless probes show traffic.

**Следующий цикл:** расширенный охват **Cov-P7+** — [`plan-hint-coverage-expansion.md`](./plan-hint-coverage-expansion.md) (master dictionary ~450 queries, фазы Cov-P0…P12, слои R0–V8).

## Проверка

```bash
npx vitest run src/lib/ved/__tests__/hint-coverage-p*.test.ts
npm run test:hint-precision
npm run test:ci
```

Agent cannot merge.
