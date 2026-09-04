# План: C21 multi-step (purpose → composition) → any-help ≥95%

**Дата:** 2026-09-03. **D33.**  
**Статус:** **done** — Phase A–G · plan-s7 pack-hit **100%** · orphan UI **Won't wire** · fingerprint hsHint dual-path · G5 live **H6/H7 PASS** prod 2026-09-04 (H5 search 4/6 — FTS rank residual).  
**Зона:** 1 Client + 3 Ядро (`tnved-hint-trees`, `clarify-ai`, NewCalc).  
**Канон:** [`plan-tnved-hint-trees.md`](./plan-tnved-hint-trees.md) · [`plan-fill-hints-structure.md`](./plan-fill-hints-structure.md) · [`plan-hint-coverage-expansion.md`](./plan-hint-coverage-expansion.md) · [`plan-hint-gap-probe-run.md`](./plan-hint-gap-probe-run.md) · [`staging.md`](./staging.md) · D15 / D27 / D32 / D33.

**Не:** LLM-CTA на NewCalc · scrape Альта · новые листья ТН ВЭД · 14 948 деревьев · >3 обязательных шага до create.

---

## 1. Идея

Унифицировать путь:

```text
короткое имя («Очки»)
  → шаг A: применение / форма
  → шаг B: состав / материал (если влияет на код или create attrs)
  → шаг C (опц.)
  → apply → description + attrs + hsHint (heading ≠ final)
  → cascade / precedent / heuristic → AI_READY
```

Применять **только** где ветвление меняет существующий `hsHeading` или обязательный attr.  
Цель горизонта: **any-help ≥95%** на plan-s7 (без POLICY), STEAL/MISROUTE = 0 на golden.

---

## 2. Анализ (as-is 2026-09-03, после auto residual)

| Факт | Значение |
|------|----------|
| Packs | **86** (`tnved-hint-tree-packs.json`) |
| Multi-step packs (`steps.length≥2`) | **38** |
| Shallow P0 left | **0** |
| P1 multi_same_hs left | **0** |
| Primary UI | C12 ClarifyField на `/cabinet/new` |
| **Golden** (`--fail-on steal,misroute`) | **OK** · STEAL/MISROUTE = **0** |
| **plan-s7** | pack-hit **100%** (371/371) · any-help **100%** · miss **0** · diverge **0** · observe **0** |
| Was C/E | pack-hit **99.5%** · auto CASCADE×2 |

Инвентарь: [`../../src/lib/ved/c21-multistep-inventory.json`](../../src/lib/ved/c21-multistep-inventory.json).

**Done multistep (B):** optics, headphones, umbrellas, lamps, security-cam, chocolate, cookware, tableware, networking, pet-food, rugs, tires.  
**Done apparel (F5):** hosiery, outerwear, dresses, gloves-scarves, tie-belt, underwear-sleep, suits.  
**Done food (C):** snacks (+морс), spirits, beverages, milk, tea-coffee deepen.  
**Done elec (E):** pc-parts (+HDD), power (+hdmi), displays, watches, gaming deepen.  
**Done auto residual:** auto-parts (+воздушный фильтр / маслофильтр; oil 842123 · air 842131).  
**Done Phase F:** P1 closed (sports, jewelry 7113/7117, auto-body, forklift-trucks) · long-tail deepen bags/camping/cosmetics/batteries · `бижутерия` trigger.

### Residual (observe)

| Domain | pack% | any% | Заметка |
|--------|-------|------|---------|
| apparel / food / elec / auto / home / long | **100%** | 100% | observe **0** ✅ · miss-driven Phase F: no new MISS on plan-s7 |

---

## 3. Архитектура

### 3.1 Схема pack (additive)

```json
{
  "id": "optics",
  "triggers": ["очки", "sunglasses"],
  "skipQuestionIds": ["kind"],
  "steps": [
    {
      "id": "optics-purpose",
      "text": "Какие это очки?",
      "options": [
        { "id": "sun", "label": "Солнцезащитные", "value": "солнцезащитные очки", "hsHeading": "900410" },
        { "id": "corrective", "label": "Коррекционные / прочие", "value": "коррекционные очки", "hsHeading": "900490" }
      ]
    },
    {
      "id": "optics-material",
      "text": "Из чего оправа / основная часть?",
      "options": [
        { "id": "plastic", "label": "Пластик", "value": "пластик", "hsHeading": "", "attrs": { "composition": "пластик" } }
      ]
    }
  ]
}
```

- Legacy `question` = `steps[0]` (normalize в loader).  
- `hintTreeQuestions` возвращает **все** steps как отдельные вопросы (совместимо с текущим Clarify UI без progressive fetch).  
- `hsHint`: самый длинный digits из отвеченных options (точнее heading).  
- Пустой `hsHeading` на material-step — только attrs.  
- Max **3** steps на pack.

### 3.2 Метрики done-when (горизонт)

| Метрика | Target | Auto residual (2026-09-03) |
|---------|--------|------------------|
| any-help plan-s7 | **≥95%** | **100%** ✅ |
| pack-hit plan-s7 | **≥90%** | **100%** ✅ |
| STEAL/MISROUTE golden | **0** | **0** ✅ |
| Shallow packs с needs_branch | 0 или явный Won't | **0** ✅ |
| LLM на clarify | **0** | **0** ✅ |
| pack-hit apparel | ≥80% | **100%** ✅ |
| pack-hit food / elec / auto | ≥95% | **100%** ✅ |
| observe CASCADE (plan-s7) | 0 | **0** ✅ |

---

## 4. Фазы (слоты ~100)

| Фаза | Шаги | Содержание | Статус |
|------|------|------------|--------|
| **A** Каркас | 1–8 | План · инвентарь · `steps[]` · unit · baseline probe | **done** |
| **B** Эталоны | 9–20 | 12 multistep · B12 baseline | **done** |
| **C** Food | 21–35 | snacks+морс · spirits/beverages/milk/tea-coffee deepen | **done** |
| **D** Apparel/home | 36–50 | F5 apparel packs | **done** (apparel) |
| **E** Elec/auto | 51–65 | HDD/hdmi · displays… + auto filters | **done** |
| **F** Long-tail | 66–80 | P1 close + long deepen (miss=0 on s7) | **done** |
| **G** Quality 95% | 81–100 | orphan Won't · fingerprint · probe 100% · staging | **done** (offline; G5 DEFER) |

### Phase A checklist

- [x] A1 План в KB + индекс README  
- [x] A2 Инвентарь JSON (`c21-multistep-inventory.json`)  
- [x] A3 Loader `steps[]` + legacy `question` (`packSteps`)  
- [x] A4 Unit: normalize + optics chain (`tnved-hint-trees.test.ts`)  
- [x] A5 `hsHintFromClarify` prefers longest heading  
- [x] A6 `hintTreesAsSearchExtras` / focusCodes walk steps  
- [x] A7 Hygiene / existing hint tests green (343 targeted PASS)  
- [x] A8 UI: pack steps progressive (F4) — composition после `tnved-form` (не все сразу)

### Phase B start

- [x] B9 `optics` purpose → material (эталон «Очки»)  
- [x] B10 Fixture + fill-hints case «очки»  
- [x] B11a `headphones` form → composition  
- [x] B11b `umbrellas` type fork → composition  
- [x] B11c `lamps` + `security-cam`  
- [x] B11d Остаток P0: chocolate, cookware, networking, pet-food, rugs, tableware, tires  
- [x] B12 Baseline `probe:hint-gap` (2026-09-03): golden 100 OK · plan-s7 pack **92.7%** / any-help **100%** · STEAL=0  
- [x] B13 Hygiene catch-all: removed empty «уточнить» / replaced with concrete attrs; gate unit  
- [x] B14 Noisy-branch QA: [`plan-c21-noisy-branch-qa.md`](./plan-c21-noisy-branch-qa.md)  
- [x] B15 F1–F3: skip leaks · оправа triggers · `npm run probe:c21-noisy` (36/36 · leaks 0)  
- [x] B16 F4 progressive pack steps (`progressiveClarifyQuestions` на NewCalc + lab wizard)
- [x] F5 Apparel packs (7): hosiery…suits · plan-s7 apparel **100%** · overall pack-hit **98.7%**
- [x] C Food: морс→snacks · deepen milk/snacks/beverages/spirits/tea-coffee · food pack-hit **100%**
- [x] E Elec: HDD→pc-parts · hdmi→power · deepen displays/watches/gaming/pc-parts/power · elec **100%** · plan-s7 pack-hit **99.5%**
- [x] Auto residual: воздушный фильтр / маслофильтр → auto-parts (842131 / 842123) · plan-s7 pack-hit **100%** · observe **0**
- [x] Phase F: P1→0 (sports/jewelry/auto-body/forklift) · bags/camping/cosmetics/batteries · jewelry 7117 · noisy N44–N50 · same-length heading prefers later step
- [x] Phase G offline: orphan UI Won't-wire gate · fingerprint `hsHint`+extras dual-path Next↔api · G0 coverage/precision/golden/noisy · staging H3b **100%** · G5 live DEFER

### Phase G checklist (2026-09-03)

| ID | Содержание | Статус |
|----|------------|--------|
| G-orphan | AttrSuggestChips / HsHintCandidates **не** на NewCalc (C21 clarify = primary) | **done** Won't wire + unit gate |
| G-fp | `buildCanonicalText` + hsHint digits / foodKind / deviceType / footwearType; api parity | **done** |
| G-probe | pack-hit ≥95% | **100%** plan-s7 + full |
| G-staging | [`staging.md`](./staging.md) C21b closeout + H5–H7 checklist | **done** offline |
| G5 live | H5–H7 post-deploy prod | **DONE** 2026-09-04 · H6 4/4 · H7 browser 4/4 · H5 search 4/6 (морс/HDD FTS) |

**B12 / F5 / C–E / auto / F / G команды:**

```bash
npm run probe:hint-gap -- --fail-on steal,misroute
npm run probe:hint-gap -- --full --source plan-s7 --format summary
npm run probe:hint-gap -- --full --format summary
```

### B13 Noise inventory (2026-09-03)

**Уровень catch-all: низкий** (не «высокий» — полная перепись packs не нужна).

| Класс | До | После B13 | Вердикт |
|-------|-----|-----------|---------|
| vague+empty (`уточнить` / «другой» без HS) | 3 | **0** | удалено / заменено на конкретное |
| cookware `other-metal` (HS=7323 + «уточнить») | 1 | **0** | удалён (дубль steel) |
| empty HS composition (пластик/металл/…) | ~31 | ~30 | **не шум** — attrs create; без кода по дизайну |
| vague **с** реальным HS (`прочие` TN wording) | 9 | 8 переименованы конкретнее | `180690` / `660199` / `900490` — канон ТН, оставить |

Правки: tires −`Прочие/уточнить`; pet-food `Другие животные`→`Для птиц`; rugs `Смешанный/другой`→`Хлопок`; cookware −`Другой металл`; лейблы headgear/footwear/fruit/woven/prepared без «уточните».

---

## 5. Правила микрошага

1. Кандидат из инвентаря / miss-log.  
2. HS только существующие headings.  
3. purpose first, composition second.  
4. ≥3 positive / ≥5 mustNot.  
5. unit + `test:hint-coverage` / precision затронутое.  
6. `probe:hint-gap --fail-on steal,misroute`.  
7. Строка статуса в этом плане.

Стоп при STEAL или выдуманном коде.

---

## 6. Не делать

Новые листья · scrape · LLM clarify CTA · ветвление без смены HS/attrs · >3 шагов · pack на каждый leaf.

---

## 7. Закрытие программы

any-help ≥95% ✅ · pack-hit ≥90% ✅ (100%) · shallow P0 / P1 закрыты ✅ · optics эталон + progressive F4 ✅ · KB/staging ✅ · **G5 live H6/H7 PASS** · H5 FTS residual (морс/HDD) miss-driven.
