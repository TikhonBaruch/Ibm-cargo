# Plan: Hint coverage P0–P5

**Дата:** 2026-08-31. **D33.**  
**Статус:** **P0–P5 done** (this PR).  
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

### New open test sections (no C21 pack yet / weak)

| Секция | Примеры |
|--------|---------|
| cosmetics-detail | помада, шампунь (pack `cosmetics` exists but narrow) |
| soap / oral | мыло, зубная паста |
| baby | подгузник, памперс |
| tools | дрель, молоток |
| cookware / tableware | кастрюля, сковорода, тарелка |
| textiles-home / rugs | одеяло, подушка, ковёр |
| batteries | батарея, аккумулятор |
| networking / printers / monitors / tv | роутер, принтер, монитор, телевизор |
| auto-parts / bearings | фильтр масляный, свеча, подшипник |
| sports / camping / umbrellas / optics | мяч, палатка, зонт, очки |
| med-disposables | шприц, бинт |
| pet-accessories / litter | ошейник, поводок, наполнитель |
| toys-extra | лего (общий `toys` есть) |

Next slice **P5**: pick 6–8 highest-traffic sections (cosmetics-detail, tools, cookware, batteries, networking, baby…).


## C10 — Post-cycle re-probe (after P5)

**0 NEW WRONG** on P5 matrix. Closed C9: cosmetics-detail, soap/oral, baby, tools, cookware/tableware, batteries, networking, home-textiles.

### Still open (P6 candidates)

| Секция | Примеры |
|--------|---------|
| rugs | коврик, ковёр |
| sports / camping / umbrellas | мяч, палатка, зонт |
| optics | очки |
| med-disposables | шприц, бинт |
| pet-accessories / litter | ошейник, наполнитель |
| printers / monitors / tv / peripherals | принтер, монитор, телевизор, клавиатура |
| auto-parts / bearings | фильтр, свеча, подшипник |
| security-cam | камера видеонаблюдения |
| toys-extra | лего |

## Проверка

```bash
npx vitest run src/lib/ved/__tests__/hint-coverage-p*.test.ts
npm run test:hint-precision
npm run test:ci
```

Agent cannot merge.
