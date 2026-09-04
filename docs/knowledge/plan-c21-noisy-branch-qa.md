# План QA: C21 noisy-branch (корректность ветвления подсказок)

**Дата:** 2026-09-03. **D33.**  
**Статус:** **F1–F4 done** (2026-09-03) — noisy **36/36** · leaks **0** · progressive steps.  
**Канон:** [`plan-c21-multistep-all-families.md`](./plan-c21-multistep-all-families.md) · [`plan-fill-hints-structure.md`](./plan-fill-hints-structure.md) · [`plan-hint-gap-probe-run.md`](./plan-hint-gap-probe-run.md).

**Не:** live SSO staging · LLM clarify · выдуманные листья ТН ВЭД.

---

## 1. Цель теста

Проверить, что на **изначально шумных / коротких** запросах:

1. pack выбирается без STEAL;  
2. ветка purpose/form → composition даёт **реальный** `hsHint`;  
3. category-вопросы C12 не дублируют pack (шум UI);  
4. POLICY bare-слова остаются без pack.

---

## 2. План теста (контур)

| # | Шаг | Команда / артефакт | Gate |
|---|-----|---------------------|------|
| T0 | Hygiene catch-all | unit `hygiene: no catch-all…` | 0 vague+empty |
| T1 | Golden STEAL | `npm run probe:hint-gap -- --fail-on steal,misroute` | 100 OK |
| T2 | Noisy corpus | `npm run probe:c21-noisy` | **100%** · **0** category leaks · exit≠0 on fail |
| T3 | Fill scripts | `fill-hints-structure` + `tnved-hint-trees` | green |
| T4 | (opt) plan-s7 | `probe:hint-gap -- --full --source plan-s7` | pack≥90 · any≥95 |
| T5 | (later) staging H6 | NewCalc ручной: очки / лампа / камера | human |

---

## 3. Результат после F1–F3 (2026-09-03)

| Метрика | До QA | После F1–F3 |
|---------|-------|-------------|
| Noisy hard OK | 97.2% (+1 soft) | **36/36 = 100%** |
| Category leaks | **17** | **0** |
| `оправа` → optics | soft fail | **OK** (hs branch frames `9003`) |
| Golden STEAL | 0 | **0** |
| Units | — | trees+precision+fill green |

### 3.1 Что сделано

| ID | Fix |
|----|-----|
| **F1** | Multistep packs: `skipQuestionIds` += material / dishes-material / device / brand-model / packaging / specs / origin |
| **F2** | optics triggers: `оправа`, `оправы` (bare `линза` остаётся mustNot) |
| **F3** | `npm run probe:c21-noisy` · exit 1 hard fail · exit 2 category leak |

### 3.2 Остаток (не этот цикл)

| Тема | Severity |
|------|----------|
| Apparel packs (носки/куртка) | **F5 done** |
| Food/elec CASCADE (морс/HDD/hdmi) | **C/E done** |
| Auto фильтры | **done** (auto-parts) |
| `колесо` → tires | Won't / later |

### 3.3 F4 progressive

`progressiveClarifyQuestions(qs, answers, packStepIds)` в `new-calc-clarify.ts` · wired в `NewCalcPane` + lab `client-wizard`.  
До ответа `tnved-form` composition скрыт; copy: «Сначала назначение / форма, затем состав».

### 3.2 Качество следования ветки (даже на OK)

| Наблюдение | Пример | Severity |
|------------|--------|----------|
| **Category leak** | `очки` → clarify `[tnved-form, composition, material]` — pack уже имеет composition, но **material** category не в `skipQuestionIds` | **P0 UX-шум** |
| То же | cookware/tableware → лишний `dishes-material`; security-cam → `device`; headphones → `brand-model` | P0 |
| Все steps сразу | UI показывает form+composition без progressive | P2 (by design A8) |
| `колесо` → tires | шумный, но осознанный trigger | P2 Won't / later |
| `посуда` → tableware | не cookware | P2 OK |
| Apparel null | носки/куртка — **F5** hosiery/outerwear | OK |
| Bare POLICY | камера/провод/фильтр/свеча/перец → null | OK |

### 3.3 Эталон ветки (pass)

| Query | Pack | Apply → hsHint |
|-------|------|----------------|
| очки → солнце + пластик | optics | **900410** |
| зонт → телескоп + полиэстер | umbrellas | **660191** |
| кастрюля → алюминий + форма | cookware | **7615** |
| шоколад → плитка | chocolate | **180632** |
| led лампа | led (не lamps) | — |

---

## 4. План исправлений

| ID | Статус | Содержание |
|----|--------|------------|
| **F1** | **done** | skipQuestionIds на 12 multistep (+ material/dishes/device/brand-model/specs/…) |
| **F2** | **done** | optics: `оправа`/`оправы`; bare `линза` остаётся mustNot |
| **F3** | **done** | `npm run probe:c21-noisy` · exit 1/2 gates |
| **F4** | **done** | Progressive steps: composition после ответа `tnved-form` |
| **F5** | **done** | Apparel packs: hosiery…suits · apparel pack-hit **100%** |
| **C/E** | **done** | морс/HDD/hdmi packs · food/elec **100%** |
| **Auto** | **done** | воздушный фильтр / маслофильтр → auto-parts · plan-s7 **100%** · noisy N41–N43 |
| **F** | **done** | P1→0 · bags/camping/cosmetics/batteries · jewelry 7117 · noisy N44–N50 |
| **G** | **done** offline | orphan Won't · fingerprint hsHint · probes 100% · staging; G5 DEFER |
| **F6** | Won't | catch-all «уточните» · orphan AttrSuggest UI mount · выдуманные листья |

---

## 5. Метрики

| Метрика | B12 | После F1–F5 / C–E / auto |
|---------|-----|-------------|
| any-help plan-s7 | 100% | **100%** |
| pack-hit plan-s7 | 92.7% | **100%** |
| apparel pack-hit | 52.2% | **100%** |
| food / elec / auto | 99% / 95.9% / 93.3% | **100%** |
| observe CASCADE | 5 | **0** |
| noisy branch | 97.2% soft | **100%** (N01–N50) |
| category leaks | 17 | **0** |
| STEAL golden | 0 | **0** |
