# План прогона: `probe:hint-gap` (golden + full observe)

**Дата:** 2026-09-01. **D33.**  
**Статус:** план · **Cov-P13–P19 done** · G5 live H5–H7 **DEFER** (no deploy).  
**Зависит от:** Cov-P12 tooling (#56).  
**Канон:** [`plan-hint-coverage-expansion.md`](./plan-hint-coverage-expansion.md) · [`staging.md`](./staging.md) §Cov · [`testing-branches.md`](./testing-branches.md).

---

## 1. Идея

После Cov-P0…P12 (**78 packs**) нужен **повторяемый прогон**, а не разовый diff: измерить охват, отделить регрессии от residual gap, и только потом открывать следующий код-цикл.

**Два контура (не смешивать):**

| Контур | Команда | Роль | Fail gate |
|--------|---------|------|-----------|
| **Golden** | `npm run probe:hint-gap` | регрессия 50 golden rows | `--fail-on steal,misroute` |
| **Full observe** | `npm run probe:hint-gap:full` | покрытие plan-s7 (~386) + precision | **нет** fail на MISS/DIVERGE |

Знаменатель покрытия = **plan-s7 household** (POLICY строки вычитаются). Precision-positives = 100% by construction — не использовать как % coverage.

---

## 2. As-is (после первого `--full`, 2026-09-01)

| Срез | n | denom | pack-hit | any-help | miss | diverge |
|------|---|-------|----------|----------|------|---------|
| plan-s7 | 386 | 376 | **80.9%** | **86.7%** | 50 | 2 |
| + precision | 516 | 506 | 85.8% | 90.1% | 50 | 2 |
| Golden dictionary | 50 | — | — | — | **50/50 OK** | 0 STEAL |

**Цели следующего цикла (не этот план = код):**

| Метрика | Сейчас | Target после residual |
|---------|--------|----------------------|
| pack-hit (plan-s7) | ~81% | **≥88%** |
| any-help (plan-s7) | ~87% | **≥93%** |
| STEAL/MISROUTE (golden) | 0 | **0** (не regress) |
| POLICY-HIT | 1 (`ореховое молоко`) | **0** |

---

## 3. Артефакты прогона

| Артефакт | Путь | Назначение |
|----------|------|------------|
| Golden dictionary | `src/lib/ved/__tests__/hint-coverage-probe-dictionary.json` | hard expected |
| Full corpus | `src/lib/ved/__tests__/hint-coverage-full-corpus.json` | observe rows |
| Corpus builder | `scripts/build-full-corpus.py` | regenerate после правок §7 / precision |
| Probe CLI | `scripts/hint-gap-probe.ts` | golden + `--full` |
| Phase units | `hint-coverage-p*.test.ts` | per-phase matrix |
| Staging live | [`staging.md`](./staging.md) §Cov H5–H7 | human SSO |

**Пересборка корпуса (когда меняли plan §7 examples или precision fixture):**

```bash
python3 scripts/build-full-corpus.py
# → rows ≥380 · plan-s7 ≥350 · policy ≥8
```

---

## 4. Процедура прогона (runbook)

Выполнять **строго по порядку**. Стоп на первом красном gate.

### G0 — Pre-flight

```bash
git status -sb
npm run test:hint-coverage          # p0…p12 units
npm run test:hint-precision
npm run probe:hint-gap -- --fail-on steal,misroute
```

**Gate:** 0 STEAL · 0 MISROUTE · vitest green.

### G1 — Golden table (диагностика)

```bash
npm run probe:hint-gap -- --format table
npm run probe:hint-gap -- --live --format table
```

Смотреть `kind≠OK`. Live-подмножество = staging H6 candidates.

### G2 — Full observe (coverage)

```bash
npm run probe:hint-gap:full
# эквивалент:
npm run probe:hint-gap -- --full --format summary
npm run probe:hint-gap -- --full --source plan-s7 --format summary
```

Записать в miss-log (секция ниже / PR body):

| Поле | Откуда |
|------|--------|
| pack% / any% / miss / diverge | summary header |
| per-domain table | `domain\tn\tpack%…` |
| MISS list | observe rows `kind=MISS` |
| DIVERGE list | `kind=DIVERGE` |
| POLICY-HIT | `kind=POLICY-HIT` |
| ATTR-only (no pack) | `kind=ATTR` — обычно OK (apparel path) |

**Gate:** не fail. Сравнение с предыдущим прогоном: pack% не упал >1 п.п. без объяснения; **0 NEW STEAL** в golden.

### G3 — Domain triage (классификация MISS)

Каждый MISS / DIVERGE / POLICY-HIT → один бакет:

| Бакет | Критерий | Действие |
|-------|----------|----------|
| **T+ trigger** | pack exists, stem missing | добавить trigger / morphology |
| **P+ pack** | нет pack, нужен новый leaf | новая фаза packs |
| **A+ attr** | pack intentional null, нужен RULE | attr-suggest (как Cov-P10) |
| **S+ cascade** | pack/attr ok, search prefix пуст | invoice alias (как Cov-P11) |
| **G guard** | steal / sibling diverge | guard / denylist / wantPack fix |
| **POLICY** | ambiguous bare | оставить null; не патчить ради % |
| **DEFER** | low traffic / industrial | backlog, не блокер |

### G4 — Phase plan (только после triage)

Не писать packs до секции фазы в KB (D33). Одна фаза = один PR, runbook expansion §11:

```text
PRE → PLAN → CODE → TEST → R0 probe → FIX STEAL → R1–R7 → CI → PR → POST re-probe G2
```

### G5 — Live (human, post-merge)

[`staging.md`](./staging.md) §Cov H5–H7. Agent **не** SSO. Offline H1–H4 / H3b = pre-flight.

```bash
# post-merge
# POST /api/v1/calculations/attr-suggest { "description":"рис" }
# GET /api/v1/tnved/search?q=рыба
# /cabinet/new → playstation ≠ toys
```

### G6 — Closeout

1. Цифры G2 → секция «Прогон N» в этом файле + expansion §Cov notes.  
2. Golden rows: добавить ≥1 probe на каждый **новый** pack/RULE.  
3. `npm run test:ci`.  
4. KB index / staging H3b обновлены.

---

## 5. Классификация исходов (`--full`)

| kind | Смысл | Gate |
|------|-------|------|
| **PACK** | `matchHintPack` hit; wantPack null или совпал | OK |
| **DIVERGE** | pack hit, но ≠ wantPack (hint) | triage G/T |
| **ATTR** | no pack; A+ или A~ | often OK (apparel) |
| **CASCADE** | no pack/attr help; cascade HS | S+ candidate |
| **MISS** | A0 + no HS | T+/P+/A+/DEFER |
| **POLICY** | marked policy, pack null | OK |
| **POLICY-HIT** | marked policy, pack hit | **fix** (FALSE-POS) |

Golden kinds (без `--full`): OK / STEAL / MISROUTE / FALSE-POS / ATTR-GAP / LAYER-SPLIT / SEARCH-MISS — см. expansion §3.

---

## 6. Residual triage (прогон #1 → фазы)

Источник: observe 2026-09-01, plan-s7 MISS=50 · DIVERGE=2 · POLICY-HIT=1.

### 6.1 Must — Cov-P13 (precision / guards / plant) — **done** (this PR)

| ID | Query | Was | Fix |
|----|-------|-----|-----|
| G1 | `ореховое молоко` | milk POLICY-HIT (+ pantry steal) | `орехов\w*` in plant-dairy; skip milk+pantry; 0401 exclude |
| G2 | `коврик йога` | rugs vs sports | `isYogaMatQuery` skip rugs + sports triggers |
| G3 | `шкаф` | furniture vs bedroom-furniture | trigger `шкаф` → `bedroom-furniture` |

**Done when:** POLICY-HIT=0 · DIVERGE=0 · golden 53/53 OK (0 STEAL).

### 6.2 Must — Cov-P14 (food MISS triggers) — **done** (this PR)

| Query | Target pack / notes |
|-------|---------------------|
| вафли, торт | `grains-pasta` (+ bakery option) |
| курица | `meat` stem `куриц` (was only `курин`) |
| шампанское | `beverages` (2204 sparkling; not spirits) |
| кола, минеральная вода | `beverages` (`минеральн` fixes word-order) |
| мороженое, пельмени, пицца | extend `prepared-food` (no new pack) |

**Done when:** food miss ≤3 → **0**; golden +9 (62 OK).

### 6.3 Should — Cov-P15 (apparel / home leftovers) — **done** (this PR)

| Query | Layer |
|-------|-------|
| галстук, ремень, пижама, халат, плащ | **A+** RULES (6215/4203/6107/6201) |
| хлопок | `textiles-raw` |
| полка, стол, лампа, полотенце, посуда, контейнер | bedroom/furniture/lamps/home-textiles/tableware/cutlery |
| вешалка, корзина для белья | **DEFER** (still MISS) |

**Done when:** apparel/home miss ≤5 → apparel **0** · home **2** (DEFER only).

### 6.4 Should — Cov-P16 (elec / auto / sport / long-tail) — **done** (this PR)

| Block | Queries | Pack |
|-------|---------|------|
| Elec | микрофон, модем, свитч, саундбар, steam deck, корпус пк, мышь компьютерная | peripherals / networking / speakers / gaming / pc-parts |
| Elec POLICY | переходник, кабель (bare) | **POLICY** keep null |
| Auto | свечи зажигания, диск тормозной, колесо, зеркала боковые | auto-parts / tires / auto-body |
| Auto POLICY | шланг (bare) | POLICY |
| Sport | лыжи, коньки, ролики, ракетка | `sports` triggers |
| Long | фломастер, бусы, кулон, гармонь | stationery / jewelry / musical |
| Industrial | труба, арматура, бумага туалетная, маска медицинская, миска для животных | DEFER / thin |

**Done when:** plan-s7 pack-hit ≥88% → **90.9%**; miss **7** (home DEFER 2 + industrial DEFER 5); POLICY-HIT 0.

### 6.5 Cascade-only (S+, Cov-P17) — **done** (this PR)

Уже CASCADE (не MISS): морс · варежки · HDD · hdmi кабель · воздушный/масло фильтр — alias + fixture golden.

**Done when:** 6 CASCADE rows in dictionary + classify-cascade fixture; golden 95/95 OK.

### 6.6 Cov-P18 — offline closeout (no deploy)

**Scope:** G0–G3 + G6 без live SSO. G5 (H5–H7 prod/preview) — **DEFER** до human merge → main → deploy.

| Gate | Команда / артеfact | Ожидание | Статус |
|------|-------------------|----------|--------|
| G0 | `npm run test:hint-coverage` + `test:hint-precision` + golden `--fail-on` | 0 STEAL | **PASS** |
| G1 | `probe:hint-gap --live` | live subset OK (post-P18 rows) | **PASS** offline |
| G2 | `probe:hint-gap:full --source plan-s7` | pack **90.9%** · any **98.1%** · miss **7** | **PASS** |
| G3 | miss-log | 7 DEFER only (home×2 + industrial×5) | **closed** |
| G5 | staging §Cov H5–H7 | prod search / attr / NewCalc | **DEFER** |
| G6 | KB + staging H3b + live checklist | this PR | **PASS** |

**Residual DEFER (not bugs):** вешалка · корзина для белья · труба · арматура · маска медицинская · бумага туалетная · миска для животных.

**Post-deploy checklist:** [`staging.md`](./staging.md) §Cov P13–P17 live block.

### 6.7 Cov-P19 — residual DEFER thin (no deploy) — **done** (this PR)

| Query | Action |
|-------|--------|
| вешалка, корзина для белья | `home-textiles` |
| маска медицинская | `med-disposables` (word-order triggers) |
| миска для животных | `pet-accessories` |
| бумага туалетная | `cleaning` |
| труба, арматура | **POLICY** (ambiguous industrial) |

**Done when:** plan-s7 miss **0** · any **100%** · pack-hit ≥92%.

---

## 7. Фазы реализации (MoSCoW)

| ID | Scope | Pack Δ | Probe | Done when |
|----|-------|--------|-------|-----------|
| **Cov-P13** | plant + diverge guards | 0 | +3 golden | **done** — POLICY-HIT=0; DIVERGE=0 |
| **Cov-P14** | food triggers / prepared-food fork | 0 | +9 golden | **done** — food miss 0; pack-hit 83.2% |
| **Cov-P15** | apparel RULES + home stems | 0 | +12 golden | **done** — apparel miss 0; home miss 2 (DEFER); any 92.3% |
| **Cov-P16** | elec/auto/sport/long triggers | 0–2 | +15 | **done** — plan-s7 pack-hit **90.9%**; miss 7 DEFER |
| **Cov-P17** | cascade aliases for CASCADE rows | — | +6 golden | **done** — 6 S+ rows fixture; golden 95/95 |
| **Cov-P18** | offline closeout + live checklist prep | — | probe #7 | **done** offline · G5 DEFER |
| **Cov-P19** | residual DEFER thin + industrial POLICY | 0 | +5 golden | **done** — plan-s7 miss **0**; any **100%** |

**Не делать в этих фазах:** scrape Альта · `tnved:load --full` на sweb · трогать taurus-liart (D37) · раздувать golden до всего корпуса (observe ≠ golden).

---

## 8. Команды (шпаргалка)

```bash
# Golden gate
npm run probe:hint-gap -- --fail-on steal,misroute
npm run probe:hint-gap -- --phase Cov-P7 --format table

# Full observe
npm run probe:hint-gap:full
npm run probe:hint-gap -- --full --source plan-s7 --format summary
npm run probe:hint-gap -- --full --domain food --format misses
npm run probe:hint-gap -- --full --format json > /tmp/hint-gap-full.json

# Regenerate corpus
python3 scripts/build-full-corpus.py

# Units
npm run test:hint-coverage
npm run test:hint-precision
npm run test:ci
```

---

## 9. Расписание одного прогона (чеклист)

```text
[x] G0 pre-flight (coverage + precision + golden fail-on)
[x] G1 golden table / live subset
[x] G2 full observe → записать pack%/any%/miss
[x] G3 triage MISS → T+/P+/A+/S+/G/POLICY/DEFER
[x] G4 Cov-P13…P17 code cycles (merged #58–#62)
[ ] G5 live H5–H7 (human, post-deploy) — DEFER
[x] G6 KB closeout + corpus rebuild if §7 changed
```

**Критерий «прогон сдан» (offline):** G0–G3 + G6 выполнены; цифры в §11; golden 0 STEAL. G5 — после deploy на prod/preview.

---

## 10. Связь с KB

| Файл | Роль |
|------|------|
| [`plan-hint-coverage-expansion.md`](./plan-hint-coverage-expansion.md) | packs Cov-P7–P12 · §7 dictionary map |
| [`plan-hint-coverage-p0.md`](./plan-hint-coverage-p0.md) | P0–P6 + C11 re-probe pointer |
| [`plan-hint-chains-precision-audit.md`](./plan-hint-chains-precision-audit.md) | must-not / short triggers |
| [`staging.md`](./staging.md) §Cov | H1–H7 live |
| этот файл | **как** гонять probe · residual фазы P13+ |

---

## 11. Журнал прогонов

| # | Дата | Branch/PR | plan-s7 pack% | any% | miss | diverge | POLICY-HIT | Notes |
|---|------|-----------|---------------|------|------|---------|------------|-------|
| 1 | 2026-09-01 | #56 Cov-P12 | 80.9 | 86.7 | 50 | 2 | 1 | first `--full`; tooling landed |
| 2 | 2026-09-01 | #58 Cov-P13 | 80.9 | 86.7 | 50 | **0** | **0** | plant/yoga/шкаф guards |
| 3 | 2026-09-01 | #59 Cov-P14 | 83.2 | 89.1 | 41 | 0 | 0 | food miss 0 |
| 4 | 2026-09-01 | #60 Cov-P15 | **85.1** | **92.3** | **29** | 0 | 0 | apparel 100% any; home miss 2 DEFER |
| 5 | 2026-09-01 | #61 Cov-P16 | **90.9** | **98.1** | **7** | 0 | 0 | elec/auto/sport/long |
| 6 | 2026-09-01 | #62 Cov-P17 | **90.9** | **98.1** | **7** | 0 | 0 | 6 CASCADE S+ golden |
| 7 | 2026-09-01 | #63 Cov-P18 offline | **90.9** | **98.1** | **7** | 0 | 0 | G0–G3+G6; G5 DEFER |
| 8 | 2026-09-01 | Cov-P19 (this PR) | **92.7** | **100** | **0** | 0 | 0 | residual DEFER closed; труба/арматура POLICY |

---

## 12. Out of scope

- Traffic-weighted prod sample (нужен отдельный log ingest).  
- Подмена golden fail-on результатами observe MISS.  
- Merge stack #50–#56 агентом (human).  
- Live SSO Visit Preview агентом.
