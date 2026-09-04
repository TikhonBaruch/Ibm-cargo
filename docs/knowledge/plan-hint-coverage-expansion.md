# План: расширенный охват подсказок (Cov-P7+) — проход, словарь, выявление ошибок

**Дата:** 2026-09-01. **D33.**  
**Статус:** **Cov-P0…P19** done (#50–#64) · stack → **main** (this PR) · **78 packs.** plan-s7 miss **0**.  
**Следующий:** deploy → staging §Cov H5–H7 (human SSO).  
**Канон:** [`plan-hint-coverage-p0.md`](./plan-hint-coverage-p0.md) (P0–P6, 53 packs) · [`plan-hint-chains-precision-audit.md`](./plan-hint-chains-precision-audit.md) (precision P0–P7) · [`plan-fill-hints-structure.md`](./plan-fill-hints-structure.md) (слои H1–H5).

---

## 1. Идея

После P0–P6 (**53 C21 packs**) остаётся **~70%** бытовых запросов без pack-match и известные **WRONG** (cross-family steal). Цель цикла Cov-P7+ — **расширить охват измеримо** и на каждой фазе **ловить неверные сопоставления** до merge, а не post-factum на prod.

**Не смешивать с precision P7:** там `packTriggerMatches` / short-trigger hygiene. Здесь **Cov-P*** = coverage expansion + regression matrix.

---

## 2. As-is baseline (после P6)

| Метрика | Значение |
|---------|----------|
| C21 packs | **53** (stack #48 → main) |
| attr-suggest RULES | ~12 (носки, обувь, кепка, молоко, produce, майка, джинсы, куртка/платье, ноутбук, телефон) |
| field-suggest itemName | ~20 (Dashboard typeahead) |
| Probe corpus (gap script) | ~280 RU queries → **~262 null pack** |
| Известные WRONG (stack) | лимонад→fruit-fresh · кофемашина→tea-coffee · автокресло→furniture · порошок→appliances |

**POLICY null (не баг):** `кот`/`собака` (live animals) · bare `камера`/`фильтр`/`свеча`/`перец` · `мышь` (pointer) · plant «молоко ореховое» ≠ milk · `куртка`/`платье` → **attr-path**, не pack (P0).

---

## 3. Классификация исходов probe

Каждый запрос из словаря получает **ожидаемый исход** по слоям:

| Код | Слой | Ожидание | Пример |
|-----|------|----------|--------|
| **P+** | C21 pack | `matchHintPack` → свой pack | «рис» → `grains-pasta` (после Cov-P7) |
| **P0** | C21 pack | `null` (намеренно) | «куртка» → null pack |
| **A+** | attr-suggest | RULE с `hsHint` | «носки» → 6115 |
| **A~** | attr-suggest | clarify-only (`clarifyPack`) | «огурец» → produce-fresh chips |
| **A0** | attr-suggest | generic purpose | «рис» до Cov-P7 |
| **S+** | search/cascade | top-family prefix | «огурец» → 07xx |
| **F+** | field-suggest | itemName hit | «кроссовки» local |

**Типы ошибок (фиксируем в miss-log):**

| Тип | Описание | Действие |
|-----|----------|----------|
| **STEAL** | Чужой pack выиграл scoreKeys | guard / trigger fix / denylist |
| **MISROUTE** | Свой домен, но не тот pack | trigger split или новый pack |
| **FALSE-POS** | Pack там, где POLICY null | убрать/сузить trigger |
| **ATTR-GAP** | pack null, attr generic, пользователь без help | RULE или pack |
| **LAYER-SPLIT** | pack и attr конфликтуют | KB: один primary слой |
| **SEARCH-MISS** | search top-N не та глава | morphology / aliases |

---

## 4. Артефакты цикла

| Артефакт | Путь | Назначение |
|----------|------|------------|
| Master probe dictionary | `src/lib/ved/__tests__/hint-coverage-probe-dictionary.json` | все фазы × queries × expected |
| Full household corpus | `src/lib/ved/__tests__/hint-coverage-full-corpus.json` | observe `--full` (~516 unique; §7 + precision) |
| Phase fixtures | `hint-coverage-p7.fixture.json` … | ≥3 pos / ≥5 mustNot на pack |
| Phase tests | `hint-coverage-p7.test.ts` … | vitest per phase |
| Miss-log | секция в этом плане + PR notes | STEAL/MISROUTE до fix |
| Gap probe script | `scripts/hint-gap-probe.ts` | offline batch: pack/attr/search; `--full` observe |

**Формат строки словаря:**

```json
{
  "id": "food.rice",
  "query": "рис",
  "phase": "Cov-P7",
  "expected": { "pack": "grains-pasta", "attr": "A0|A+", "searchPrefix": "10" },
  "mustNotPack": ["produce-fresh", "fruit-fresh"],
  "notes": "новый pack"
}
```

---

## 5. Слои проверки (порядок на каждой фазе)

```text
R0  Baseline: прогнать master dictionary → miss-log (до правок)
R1  V1 pack matrix: matchHintPack + mustNot cross-family
R2  V2 clarify: hintTreeQuestions options + hsHeading per option
R3  V3 apply path: chip click → hsHint / description fragment (NewCalc unit)
R4  V4 attr-suggest: heuristicAttrSuggest hsHint / clarify-only / generic
R5  V5 search: top-1 family digits (morphology + critical-hs-queries)
R6  V6 cascade: classify prefix offline (C35e rows for new families)
R7  V7 cross-steal: соседние packs из mustNot таблицы precision audit
R8  V8 live (post-merge): NewCalc chips + POST attr-suggest на prod/preview
```

**Gate merge фазы:** R1–R7 green на golden фазы · **0 NEW STEAL** vs предыдущие фазы · `npm run test:ci`.

---

## 6. Cov-P0 — Baseline WRONG fix (до новых packs)

**Цель:** закрыть известные MISROUTE на 53 packs без расширения count.

| Query | Сейчас | Fix |
|-------|--------|-----|
| лимонад | fruit-fresh | guard juice/beverage → `beverages` |
| кофемашина | tea-coffee | trigger exclude / `appliances` |
| автокресло | furniture | `baby` trigger или guard «детск» |
| стиральный порошок | appliances | убрать steal; null или `personal-care`/chemicals pack позже |

**Acceptance:** 4 asserts в `hint-coverage-p0.test.ts` или отдельный `hint-coverage-baseline.test.ts`; re-probe C11 dictionary subset.

---

## 7. Master probe dictionary — домены

Полный корпус **~450 queries** (RU + частые EN). Ниже — сжатая карта; полный JSON — в фазовых PR.

### 7.1 Food (гл. 02–22) — **~95 queries, highest gap**

| Поддомен | Примеры probe | Целевой pack (Cov) |
|----------|---------------|-------------------|
| Крупы/макароны | рис, мука, макароны, гречка, овсянка, перловка, крупа | `grains-pasta` P7 |
| Хлеб/выпечка | хлеб, булка, печенье, крекер, вафли, торт | `grains-pasta` / `bakery` P7 |
| Мясо/колбасы | колбаса, сосиски, ветчина, бекон, мясо, говядина | `meat` P7 |
| Рыба/морепродукты | рыба, лосось, форель, тунец, икра, креветки, консервы рыбные | `fish-seafood` P7 |
| Мёд/орехи/сахар | мёд, орехи, миндаль, сахар, соль | `pantry-sweet` P7 |
| Масла/соусы | масло подсолneчное, оливковое, уксус, кетчуп, майонез, соус | `pantry-sweet` P7 |
| Снеки | чипсы, сухарики, попкорн, батончик, жвачка, мармелад | `snacks` P7 |
| Напитки без алк. | сок, компот, морс, энергетик, лимонад | `snacks` + guard vs fruit P7 |
| Спиртное | водка, коньяк, виски, ром, шампанское, ликёр | `spirits` P7 |
| Уже есть | молоко, овощи, фрукты, чай, кофе, шоколад, суп, пиво, вино | existing packs ✓ |

**Must-not food:** produce-fresh · fruit-fresh · milk · tea-coffee · chocolate · beverages (где другой подтип).

### 7.2 Apparel (гл. 61–63) — **~55 queries**

| Поддомен | Примеры | Слой |
|----------|---------|------|
| Носки/hosiery | носки, колготки, чулки, гольфы | **A+** (6115), pack optional |
| Knit top | майка, футболка, худи, свитер | knit-top ✓ |
| Woven | рубашка, брюки, джинсы, юбка | woven-apparel ✓ |
| Outerwear | куртка, пальто, пуховик, жилет | **A+** jacket; pack `outerwear` P8 optional |
| Dress/skirt | платье, сарафан | **A+** dress; P0 null pack |
| Accessories | перчатки, шарф, галстук, ремень, костюм | `apparel-accessories` P8 |
| Underwear | бельё, трусы, лифчик | `apparel-under` P8 |
| Head/foot | кепка, шапка, кроссовки | headgear/footwear ✓ |
| Fabric | ткань, хлопок, пряжа, нитки | `textiles-raw` P9 |

### 7.3 Home & kitchen (гл. 69–94) — **~70 queries**

| Поддомен | Примеры | Целевой pack |
|----------|---------|--------------|
| Мебель | матрас, кровать, шкаф, комод, полка, зеркало | `bedroom-furniture` P8 |
| Текстиль дом | шторы, жалюзи | extend home-textiles P8 |
| Климат/мелкая техника | кондиционер, обогреватель, вентилятор, чайник, блендер, мультиварка | `small-appliances` P8 |
| Кухня посуда | нож, вилка, ложка, термос, контейнер | `cutlery` P8 |
| Уборка | порошок, губка, швабра, средство для мытья | `cleaning` P8 |
| Уже есть | диван, стул, тарелка, кастрюля, пылесос, лампа, ковёр | partial ✓ |

### 7.4 Electronics (гл. 84–85, 90) — **~65 queries**

| Поддомен | Примеры | Целевой pack |
|----------|---------|--------------|
| Целые устройства | ноутбук, смартфон, планшет, ТВ, монитор | computers/displays ✓ |
| PC parts | SSD, HDD, видеокарта, CPU, RAM, БП, корпус | `pc-parts` P8 |
| Storage/periph | флешка, карта памяти, микрофон, модем, свитч | `pc-parts` / peripherals P8 |
| Cables | hdmi, переходник, кабель (generic) | power partial; `cables` P9 |
| Photo | фотоаппарат, объектив, штатив, GoPro | `photo-gear` P8 |
| Audio | наушники, колонки, саundbar | headphones/speakers ✓ |
| Gaming | playstation, xbox, геймпад | toys partial; `gaming` P9 |
| Security | камера видеонаблюдения | security-cam ✓; bare `камера` = P0 |

### 7.5 Auto & chemicals (гл. 27–38, 87) — **~45 queries**

| Поддомен | Примеры | Целевой pack |
|----------|---------|--------------|
| Шины/ходовая | шина, подшипник | tires/auto-parts ✓ |
| Фильтры/свечи | масляный фильтр, свечи зажигания | auto-parts ✓ |
| Жидкости | моторное масло, антифриз, тормозная жидкость | `auto-fluids` P8 |
| Кузов | бампер, фара, дворники | `auto-body` P9 |
| Bare ambiguous | провод, шланг, фильтр, свеча | **P0** без квалификатора |
| Бытхимия | клей, смазка, WD-40, ацетон | `adhesives-chemicals` P8 |

### 7.6 Long-tail (гл. mixed) — **~120 queries, traffic-driven**

| Поддомен | Примеры | Фаза |
|----------|---------|------|
| Канцелярия | ручка, карандаш, бумага А4, скотч, степлер | `stationery` P9 |
| Ювелирка | кольцо, серьги, браслет, цепочка | `jewelry` P9 |
| Музыка | гитара, синтезатор, скрипка | `musical` P9 |
| Табак | сигареты, табак, кальян | `tobacco` P9 (vape ✓) |
| Baby gear | коляска, пустышка, манеж, автокресло | `baby-gear` P8–P9 |
| Agri feed | комбикорм, сено, силос | `agri-feed` P9 |
| Industrial | труба, арматура, кабель силовой, розетка | `electrical-install` P9 |
| Med devices | термометр, тонометр, инвалидная коляска | `med-devices` P9 |
| Sport outdoor | лыжи, коньки, ролики, ракетка | extend sports P9 |
| Pets live | кот, собака | **POLICY** null |

---

## 8. Фазы реализации

| ID | Packs (+/-) | Pack count | Probe rows | Done when |
|----|-------------|------------|------------|-----------|
| **Cov-P0** | WRONG fixes only | 53 | 4+ regression | **done** (#50) |
| **Cov-P7** | grains-pasta, meat, fish-seafood, pantry-sweet, snacks, spirits | 53→**59** | ~95 food | **done** (#51) |
| **Cov-P8** | small-appliances, bedroom-furniture, cutlery, cleaning, pc-parts, photo-gear, auto-fluids, adhesives, baby-gear (partial) | 59→**68** | ~135 home+elec+auto | **done** (#52) |
| **Cov-P9** | stationery, jewelry, musical, tobacco, agri-feed, textiles-raw, gaming, auto-body, med-devices, electrical-install | 68→**78** | ~120 long-tail | **done** (#53) |
| **Cov-P10** | attr RULE parity: outerwear/accessories + C21 pack bridge | — | ~40 | **done** (#54) |
| **Cov-P11** | search/cascade rows для top-20 новых families | — | ~60 | **done** (#55) |
| **Cov-P12** | live H6/H7 prod checklist + miss-log triage + `--full` | — | subset | **done** (#56) |
| **Cov-P13** | plant-dairy + yoga/шкаф diverge guards | 78 | +3 golden | **done** (#58) |
| **Cov-P14** | food MISS triggers (bakery/chicken/drinks/ready) | 78 | +9 golden | **done** (#59) |
| **Cov-P15** | apparel ATTR + home/textiles stems | 78 | +12 golden | **done** (#60) |
| **Cov-P16** | elec/auto/sport/long triggers + POLICY bare | 78 | +15 golden | **done** (#61) |
| **Cov-P17** | cascade S+ for 6 CASCADE rows | 78 | +6 golden | **done** (#62) |
| **Cov-P18** | offline closeout + live checklist | 78 | probe #7 | **done** (#63) |
| **Cov-P19** | residual DEFER thin + industrial POLICY | 78 | +5 golden | **done** (#64) |

**MoSCoW:** Cov-P0 + P7 + P8 = **Must**; P9 = **Should**; P10–P12 = **Should** после merge P7–P8; P13+ = residual from [`plan-hint-gap-probe-run.md`](./plan-hint-gap-probe-run.md).

---

## 9. Cov-P7 детально (первая расширенная фаза)

### 9.1 Новые packs

| Pack | HS | Triggers (RU stems, draft) | Must-not |
|------|-----|---------------------------|----------|
| `grains-pasta` | 1006–1008, 1902 | рис, мука, макaron, гречк, овсянк, круп, лапш, спагетти, vermicelli | produce, fruit, chocolate |
| `meat` | 0201–0210, 1601 | колбас, сосиск, ветчин, бекон, мяс, говяdin, свинин, курин | produce, pet-food |
| `fish-seafood` | 0302–0307, 1604 | рыб, лосос, форел, тунец, икр, кревет, кальмар, морепродукт | meat, produce |
| `pantry-sweet` | 0801–0813, 1701 | мёд, мед, орех, миндал, сахар, соль, масло подсол, оливков | milk, produce |
| `snacks` | 1905, 2106, 2202 | чипс, сухарик, попкорн, батончик, жвачк, энергетик, **сок**, лимонad | fruit-fresh (guard!), beverages |
| `spirits` | 2208 | водк, коньяк, виски, ром, текил, ликёр, настойк, шампанск (крепк) | beverages beer/wine |

### 9.2 Guards (обязательно с packs)

- `сок` / `лимонад` / `комpot` → snacks или beverages, **не** fruit-fresh.
- `масло` disambiguation: «масло подсолнечное» → pantry; «масло сливочное» → milk (existing).
- `консервы`: рыбные → fish; овощные → produce prepared fork.

### 9.3 Probe checklist Cov-P7

```bash
npx vitest run src/lib/ved/__tests__/hint-coverage-p7.test.ts
npm run test:hint-precision
node scripts/hint-gap-probe.mjs --phase Cov-P7
npm run test:ci
```

---

## 10. Cov-P8 детально

| Pack | HS | Key probes |
|------|-----|------------|
| `small-appliances` | 8516 | чайник, блендер, мультиварка, тостер, кондиционер |
| `bedroom-furniture` | 9403–9404 | матрас, кровать, шкаф, зеркало, шторы |
| `cutlery` | 8211–8215 | нож, вилка, ложка, термос |
| `cleaning` | 3402, 9603 | порошок стиральный, губка, швабра |
| `pc-parts` | 8473, 8471 | SSD, видеокарта, флешка, RAM |
| `photo-gear` | 9006–9008 | фотоаппарат, объектив, штатив |
| `auto-fluids` | 2710, 3819 | моторное масло, антифриз, тормозные колодки |
| `adhesives-chemicals` | 3506, 2710 | клей, смазка, WD-40 |
| `baby-gear` | 8715, 9401 | коляска, автокресло (fix steal), манеж |

**Cross-steal matrix P8:** кофемашина≠tea-coffee · автокресло≠furniture · порошок≠appliances · hdmi≠power-only.

---

## 11. Процедура прохода одной фазы (runbook)

```text
1. PRE   — merge dependency (main has 53 packs)
2. PLAN  — секция фазы в этом файле + probe rows в dictionary JSON
3. CODE  — packs JSON + guards in tnved-query-match / matchHintPack
4. TEST  — fixture pos/mustNot + phase test file
5. R0    — gap-probe → miss-log.md в PR body
6. FIX   — все STEAL/MISROUTE из R0
7. R1–R7 — слои §5
8. CI    — test:ci + test:hint-precision
9. PR    — draft; human merge
10. POST — C{N} re-probe: следующий open block в §7
11. LIVE — V8 checklist staging.md после deploy
```

---

## 12. Матрица cross-family (must-not, расширение precision audit)

Для **каждого нового pack** минимум **5 must-not** из соседних семей:

| Family block | Must-not packs (always) |
|--------------|-------------------------|
| Food | produce-fresh, fruit-fresh, milk, tea-coffee, chocolate, beverages, spirits |
| Apparel | knit-top, woven-apparel, footwear, headgear |
| Electronics | computers, power, peripherals, displays, toys |
| Home | furniture, cookware, tableware, appliances, home-textiles |
| Auto | tires, auto-parts, batteries, power |

**Спец-regress (never break):** огурец→produce · йогурт→milk · майка→knit-top · кеды→footwear · ноутбук→computers · power bank→power.

---

## 13. Команды

```bash
# Полный контур coverage + precision
npm run test:hint-precision
npx vitest run src/lib/ved/__tests__/hint-coverage-p*.test.ts
npm run test:tnved-morphology
npm run test:classify-cascade
npm run test:ci

# Gap probe
npm run probe:hint-gap -- --phase all --format table
npm run probe:hint-gap -- --phase Cov-P7 --fail-on steal,misroute
npm run probe:hint-gap:full
npm run probe:hint-gap -- --full --source plan-s7 --format summary

# Live (post-merge)
# /cabinet/new → probe queries → chips + hsHint
# POST /api/v1/calculations/attr-suggest { description }
```

---

## 14. Связь с KB

| Файл | Действие |
|------|----------|
| [`plan-hint-coverage-p0.md`](./plan-hint-coverage-p0.md) | C11 → ссылка сюда; статус P6 |
| [`plan-hint-chains-precision-audit.md`](./plan-hint-chains-precision-audit.md) | must-not matrix; не дублировать P7 trigger policy |
| [`plan-fill-hints-structure.md`](./plan-fill-hints-structure.md) | ATTR-GAP / H1 orphan UI |
| [`staging.md`](./staging.md) | §Cov live V8 |
| [`plan-hint-gap-probe-run.md`](./plan-hint-gap-probe-run.md) | прогон golden/`--full` · residual Cov-P13+ |
| [`testing-branches.md`](./testing-branches.md) | `test:hint-coverage` · `probe:hint-gap[:full]` |
| [`current-app.md`](./current-app.md) | pack count после каждой фазы |

---

## 15. Жёстко не делать

- Один mega-pack «еда» / «одежда» / «электроника»
- Bare triggers без POLICY (камера, фильтр, свеча, перец)
- Pack там, где attr-path каноничен (куртка/платье) без ADR
- LLM на clarify · автозалив attrs (D15)
- Считать field-suggest заменой C21 packs
- Пропуск must-not ради «быстрее ship»

---

## 16. Следующий шаг

1. ~~Human merge **#48** (53 packs → main).~~  
2. ~~**Cov-P0:** baseline WRONG fixes + `hint-coverage-baseline.test.ts`.~~  
3. ~~**Cov-P7:** 6 food packs + `hint-coverage-p7.test.ts`.~~  
4. ~~**Cov-P8:** home + electronics parts + auto fluids.~~  
5. ~~**Cov-P9:** long-tail (stationery, jewelry, tobacco, …).~~  
6. ~~**Cov-P10:** attr RULE parity for remaining ATTR-GAP.~~  
7. ~~**Cov-P11:** search/cascade rows for new families.~~  
8. ~~**Cov-P12:** live H6/H7 prod checklist + miss-log triage + `--full`.~~  
9. ~~**Cov-P13:** plant-dairy + yoga/шкаф diverge guards.~~  
10. ~~**Cov-P14:** food MISS triggers.~~  
11. ~~**Cov-P15:** apparel/home leftovers.~~  
12. ~~**Cov-P16:** elec/auto/sport/long ([`plan-hint-gap-probe-run.md`](./plan-hint-gap-probe-run.md) §6.4).~~  
13. ~~**Cov-P17:** cascade aliases.~~  
14. ~~**Cov-P18 offline:** G0–G3+G6 closeout + live checklist.~~  
15. ~~**Cov-P19:** residual DEFER thin (hangers/mask/bowl/toilet paper; труба POLICY).~~  
16. **Post-deploy:** staging §Cov H5–H7 (human SSO).  
17. ~~**Human merge** stack → main~~ (this PR) → deploy.

Agent cannot merge.

---

### Cov-P0 notes

| Query | Было | Стало | Механизм |
|-------|------|-------|----------|
| лимонад | fruit-fresh | beverages | `isJuiceOrBeverageQuery` + trigger `лимонад` |
| кофемашина | tea-coffee | appliances | guard + `SHORT_TRIGGER_FALSE_FRIENDS` кофе/кофемаш |
| автокресло | furniture | baby | `isCarSeatQuery` guard + trigger `автокрес` |
| стиральный порошок | appliances | **cleaning** (Cov-P8; was null in Cov-P0) | `isLaundryDetergentQuery` + cleaning pack |

Unit: `hint-coverage-baseline.test.ts` (13 asserts).

### Cov-P7 notes (this PR)

| Pack | Probes | Guards |
|------|--------|--------|
| `grains-pasta` | рис, мука, макароны, хлеб | — |
| `meat` | колбаса, мясо, говядина | `preparedMeal` blocks meat on суп |
| `fish-seafood` | рыба, лосось, консервы рыбные | `fishSeafood`≠produce; `vegConserves`≠fish |
| `pantry-sweet` | мёд, орехи, масло подсолнечное | `cookingOil`≠milk; `dairyFat`≠pantry |
| `snacks` | чипсы, сок, энергетик | `juice`≠fruit-fresh |
| `spirits` | водка, виски, коньяк | ≠ beverages beer/wine |

Pack count **53 → 59**. Unit: `hint-coverage-p7.test.ts` (40 asserts) + precision fixture rows.

### Cov-P8 notes (this PR)

| Pack | Probes | Guards |
|------|--------|--------|
| `small-appliances` | чайник, блендер, кондиционер, кофеварка | кофеварка ≠ tea-coffee; кофемашина → appliances |
| `bedroom-furniture` | матрас, кровать, шторы | ≠ furniture (диван) |
| `cutlery` | нож, вилка, ложка, термос | ≠ tools / tableware |
| `cleaning` | стиральный порошок, губка, швабра | ≠ appliances (was Cov-P0 null) |
| `pc-parts` | SSD, видеокарта, флешка | ≠ computers |
| `photo-gear` | фотоаппарат, объектив | ≠ security-cam; bare камера null |
| `auto-fluids` | моторное масло, антифриз | ≠ pantry / milk |
| `adhesives-chemicals` | клей, WD-40 | ≠ paint |
| `baby-gear` | коляска, пустышка | автокресло остаётся baby |

Pack count **59 → 68**. Unit: `hint-coverage-p8.test.ts` (46 asserts).

### Cov-P9 notes (this PR)

| Pack | Probes | Guards |
|------|--------|--------|
| `stationery` | ручка, блокнот, скотч | ≠ books (тетрадь) |
| `jewelry` | кольцо, серьги, браслет | ≠ watches |
| `musical` | гитара, синтезатор | — |
| `tobacco` | сигареты, табак, кальян | e-cig → vape (skip tobacco) |
| `agri-feed` | комбикорм, сено | ≠ pet-food |
| `textiles-raw` | ткань, пряжа, нитки | ≠ knit/woven apparel |
| `gaming` | xbox, playstation, геймпад | ≠ toys |
| `auto-body` | бампер, фара, дворники | ≠ auto-parts |
| `med-devices` | термометр, инвалидная коляска | ≠ baby-gear / disposables |
| `electrical-install` | розетка, кабель электрический | ≠ power; bare провод null |

Pack count **68 → 78**. Unit: `hint-coverage-p9.test.ts` (45 asserts).

### Cov-P10 notes (this PR)

| Change | Detail |
|--------|--------|
| Apparel RULES | колготки→6115; перчатки, шарф, костюм, бельё; жилет→jacket |
| C21 bridge | `clarifyOnlyFromHintPack` — pack match → clarify-only attr (not silent generic) |
| POLICY | bare провод/камера/фильтр/свеча/перец stay generic |

Unit: `hint-coverage-p10.test.ts` (32 asserts) + `attr-suggest.test.ts` колготки.

### Cov-P11 notes

| Layer | Change |
|-------|--------|
| Cascade aliases | ~45 rows in `tnved-invoice-aliases.json` for P7–P9 families (food, home, elec, long-tail) |
| Fixture | `classify-cascade.fixture.json` +38 rows (+3 must-not guards) |
| Search S+ | invoice keys → `notesByCodeFromLabSearch` golden in `hint-coverage-p11.test.ts` |
| Guards | рисовое молоко≠1006 · подсолнечное масло≠2710 · e-cig→854340≠2402 |
| critical-hs | +10 classify alias probes in `critical-hs-queries.test.ts` |

Unit: `hint-coverage-p11.test.ts` (68 asserts). Cascade golden **35** families × alias/search matrix.

### Cov-P12 notes

| Artifact | Detail |
|----------|--------|
| Master dictionary | `hint-coverage-probe-dictionary.json` — **50** rows (P+/A+/A~/S+/POLICY) |
| Gap probe | `scripts/hint-gap-probe.ts` · `npm run probe:hint-gap` · `npm run probe:hint-gap:full` |
| Unit | `hint-coverage-p12.test.ts` — pack/attr/cascade dictionary + closed STEAL matrix |
| CI 2026-09-04 | juice S+ = **2202** (как P11); prefix matcher splits `610\|6210` · [`plan-ci-hygiene.md`](./plan-ci-hygiene.md) |
| Full corpus | `hint-coverage-full-corpus.json` — **516** unique (386 plan-s7 + 130 precision positives) |
| Builder | `scripts/build-full-corpus.py` (regenerate JSON) |
| Staging | [`staging.md`](./staging.md) §Cov H1–H7 live checklist |
| Cascade extras | лимонад/кофемашина/автокресло/сливочное/подсолнечное/суп/перчатки; wheelchair→8713 ≠8715 |
| Scripts | `npm run test:hint-coverage` |

#### Miss-log triage (closed)

| Type | Query | Was | Fix |
|------|-------|-----|-----|
| STEAL | лимонад | fruit-fresh | beverages (Cov-P0) |
| STEAL | кофемашина | tea-coffee | appliances (Cov-P0) |
| STEAL | автокресло | furniture | baby (Cov-P0) |
| MISROUTE | стиральный порошок | appliances / null | cleaning (Cov-P8) |
| STEAL | сок | fruit-fresh | snacks + guard (Cov-P7) |
| STEAL | e-cig | tobacco | vape + cascade 854340 (Cov-P9/P11) |
| STEAL | playstation | toys | gaming (Cov-P9) |
| STEAL | инвалидная коляска | baby-gear / 8715 | med-devices + cascade 8713 (Cov-P9/P12) |
| ATTR-GAP | колготки/перчатки/шарф… | generic | apparel RULES (Cov-P10) |
| SEARCH-MISS | рис/рыба/SSD/… | null cascade | invoice aliases (Cov-P11) |

#### Residual POLICY (not bugs)

`провод` · `камера` · `фильтр` · `свеча` · `перец` · `кот`/`собака` · plant «рисовое молоко» ≠ milk · `куртка`/`платье` = attr-path (no pack).

#### Full observe probe (2026-09-01)

Команда: `npm run probe:hint-gap:full` (observe, не golden). `--fail-on steal,misroute` остаётся на 50-row dictionary.

| Срез | n | denom (без POLICY) | pack-hit | any-help | miss | diverge |
|------|---|--------------------|----------|----------|------|---------|
| plan-s7 household | 386 | 376 | **80.9%** (304) | **86.7%** (326) | 50 (13.3%) | 2 |
| + precision positives | 516 | 506 | 85.8% (434) | 90.1% (456) | 50 | 2 |

Precision-блок **100%** pack-hit by construction — знаменатель покрытия = **plan-s7**. Это сжатая карта §7 (примеры, под которые писали packs), не traffic-weighted prod sample.

**DIVERGE (observe, не fail):** ~~`шкаф` → `furniture`~~ · ~~`коврик йога` → `rugs`~~ — **closed Cov-P13**.

**POLICY-HIT:** ~~`ореховое молоко` → milk~~ — **closed Cov-P13** (`орехов\w*` + skip pantry).

**MISS (0 after P19):** plan-s7 household miss closed. POLICY bare: переходник/кабель/шланг/труба/арматура (+ legacy). Food+apparel+elec+auto+sport+home residual closed.

Apparel MISS закрыт ATTR (носки…плащ) — any-help 100% на apparel.

**План прогона / residual:** [`plan-hint-gap-probe-run.md`](./plan-hint-gap-probe-run.md).

### Cov-P13 notes

| Fix | Detail |
|-----|--------|
| Plant dairy | `орехов\w*` / hazelnut / nut milk; skip milk+pantry; 0401 exclude |
| Yoga mat | `isYogaMatQuery` skip rugs; sports triggers |
| Шкаф | trigger → bedroom-furniture |

### Cov-P14 notes

| Fix | Detail |
|-----|--------|
| Bakery | `вафл`/`торт` → grains-pasta |
| Chicken / drinks / ready | meat · beverages · prepared-food |

### Cov-P15 notes

| Fix | Detail |
|-----|--------|
| Apparel A+ | галстук 6215 · ремень 4203 · пижама/халат 6107 · плащ→jacket 6201 |
| Home packs | полка · стол (+ false-friend столов) · лампа (LED guard) · полотенце · посуда (≠dishwasher) · контейнер · хлопок |
| DEFER | вешалка · корзина для белья |
| Steal fix | `isFinishedApparelQuery` skips textiles-raw for майка хлопок |
| Unit | `hint-coverage-p15.test.ts` · golden 74/74 |
| Probe #4 | pack-hit **85.1%** · any **92.3%** · miss 29 |

### Cov-P16 notes

| Fix | Detail |
|-----|--------|
| Elec | микрофон/мышь комп.→peripherals · модем/свитч→networking · саундбар · steam deck · корпус пк |
| Auto | свечи (pl.) · диск тормозной · колесо→tires · зеркала боковые |
| Sport/long | лыжи/коньки/ролики/ракетка · фломастер/бусы/кулон/гармонь |
| POLICY | переходник · кабель · шланг marked in corpus POLICY set |
| Probe #5 | pack-hit **90.9%** · any **98.1%** · miss 7 |

### Cov-P17 notes

| Fix | Detail |
|-----|--------|
| CASCADE S+ | морс · варежки · HDD · hdmi кабель · воздушный/масло фильтр |
| Aliases | hdmi keys · =морс/=варежки · =hdd |
| Fixture | +6 classify-cascade · golden dictionary 95 rows |
| Unit | `hint-coverage-p17.test.ts` |
| Probe #6 | observe unchanged (90.9%/98.1%/miss 7); golden **95/95** |

### Cov-P18 notes

| Fix | Detail |
|-----|--------|
| Offline G0–G3+G6 | golden 95/95 · live 28 rows · plan-s7 90.9%/98.1% |
| G5 DEFER | H5–H7 checklist in [`staging.md`](./staging.md) §Cov P13–P17 |
| Live subset | +10 rows: nutmilk · pizza · tie · shelf · lamp · mic · steam deck · spark · ski · morse |
| Unit | `hint-coverage-p18.test.ts` |

### Cov-P19 notes

| Fix | Detail |
|-----|--------|
| home-textiles | вешалка · корзина для белья |
| med-disposables | маска медицинская (word-order) |
| pet-accessories | миска для животных |
| cleaning | бумага туалетная |
| POLICY | труба · арматура |
| Probe #8 | pack-hit **92.7%** · any **100%** · miss **0** |

Live H5–H7: human **post-deploy** on prod/preview — agent cannot SSO.


### Residual audit: утильсбор / самоходные (2026-09-02)

**Layer G (card flags):** `8427` (погрузчики), `8429`/`8430`, `8701`… — `utilSborPossible` (ПП 81 / 1291). АКБ `8506`/`8507` — **экосбор РОП**, не утильсбор ТС.

**Закрыто Clar-DB** ([`plan-ai-clarify-db-boost.md`](./plan-ai-clarify-db-boost.md)): pack `forklift-trucks` + guard skip `batteries`; demo-pack листья `8427101000` / `8427201900`; seed прецеденты машина≠АКБ.

**Ещё gap (hold):** экскаватор / бульдозер / трактор — нет dedicated pack (Layer G util на `8429`/`8430`/`8701` при известном коде).
