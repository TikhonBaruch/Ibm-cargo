# План: проверка точности цепочек подсказок (все packs, max precision)

**Дата:** 2026-08-31. **D33.**  
**Статус:** **implementing** — **P0** merged (#37); **P1** matrix fixture + vitest (этот PR).  
Канон: [`plan-tnved-hint-chains-audit.md`](./plan-tnved-hint-chains-audit.md) (H0–H5) · [`plan-tnved-hint-trees.md`](./plan-tnved-hint-trees.md) · [`plan-fill-hints-structure.md`](./plan-fill-hints-structure.md) · [`plan-c35-offline-first-hs.md`](./plan-c35-offline-first-hs.md) · D15 / D27 / D32.

Связанный страх продукта: запрос **«огурец»** снова тянет **одежду / молоко / чужой pack**; при этом огурец бывает **свежий** или **маринованный/консервы**.

---

## 1. Идея

Закрыть вопрос «на сколько проработаны цепочки» **измеримо**: не «кажется ок», а матрица **precision / no cross-family** по **всем** C21 packs + смежным слоям (search / cascade / attr-suggest). Цель цикла — **максимум из возможного** в offline heuristic (без LLM CTA на clarify).

---

## 2. Анализ: зрелость as-is (честно)

| Слой | Зрелость | Что уже есть | Дыры |
|------|----------|--------------|------|
| C21 packs | **средняя+** | 14 packs в `tnved-hint-tree-packs.json`; `produce-fresh` с fork 0707 / 0711 / 2001 | Нет матрицы «каждый pack × чужие queries → null»; слабые exclude на triggers (`лук` короткий и т.п.) |
| Morph H1–H3 | **высокая** на кейсе огурец≠йогурт | stems, denylist, unit A–E | Корпус A–E **узкий** относительно всех packs |
| H4 aliases | **частичная** | 0707/0702/0701 invoice | Нет полного produce leaf set; ops `--search-extras` может быть не прогнан на prod DB |
| Search score | **средняя** | boundary + denylist | Live directory top-N не зафиксирован fixture’ом на все families |
| Cascade | **высокая** на must-cover | C35e ≥60% offline-hit | Produce только 3 строки; нет cross-steal asserts в fixture |
| Attr-suggest | **низкая** для produce | RULE на socks/footwear/… | **Нет produce RULE** → generic; UI chips orphan на NewCalc |
| Clarify apply | **средняя** | chips → `hsHint` heading | Нет unit: apply «маринованный» → **2001**, не 0707; «свежий» → 0707 |

### Ответ на «огурец → одежда?»

**Сейчас (после #34/#36):** pack `produce-fresh` должен выигрывать у `knit-top` / `milk` на «огурец» / «огурцы» (triggers `огурц`/`огурец`). Йогурт отделён denylist + milk pack.  
**Не гарантия «навсегда»:** любой короткий/общий trigger или scoreKeys-коллизия может вернуть чужой pack — поэтому нужен **полный cross-family регресс**, не точечный кейс.

### Свежий vs маринованный (уже в pack, слабо проверено)

| Выбор пользователя (C21) | `hsHeading` | Смысл |
|--------------------------|-------------|--------|
| Свежие / охлаждённые | **0707** | свежий огурец |
| Временно консервированные (рассол / SO₂) | **0711** | временная консервация |
| Готовые / консервы | **2001** | маринованные / уксус / корнишоны |

**Gap:** unit проверяет *наличие* опций, но **не** apply-path: клик «Готовые / консервы» → описание + `hsHint` начинается с `2001`, и **не** `61`/`04`/`65`.

---

## 3. Цель точности (канон цикла)

| Метрика | Цель (max из возможного offline) | Как мерить |
|---------|-----------------------------------|------------|
| **Pack precision** | 100% на golden queries: hit → **только** свой pack | fixture matrix |
| **Pack negative** | 100%: чужой family query → **не** этот pack | same |
| **Огурец fork** | свежий → 0707; маринад/консервы → 2001; рассол → 0711 | clarify apply unit + optional live |
| **Search top-1 family** | огурец → глава **07** (не 04/61/64/65) | morphology + live search |
| **Cascade** | огурец / огурцы → prefix **0707**; йогурт → **0403** | classify-cascade fixture |
| **Attr chips** | produce либо RULE, либо явно «clarify-only» в KB (не молчаливый generic) | attr-suggest + KB |
| **LLM на подсказках** | **0** вызовов (hold CTA) | invariant / code review |

Пороги 100% на golden — канон **этого** аудита; расширение golden только ADR/KB.

---

## 4. Матрица проверки — все packs

Каждый pack: ≥3 **positive** queries + ≥5 **must-not** (из других семей).

| Pack | Positive (min) | Must-not hit this pack |
|------|----------------|------------------------|
| `produce-fresh` | огурец, огурцы, помидор, томат, картофель, маринованные огурцы, корнишоны | молоко, йогурт, майка, кепка, кеды, ноутбук |
| `milk` | молоко, йогурт, кефир, сыр | огурец, чай, футболка |
| `tea-coffee` | чай, кофе | молоко, огурец |
| `chocolate` | шоколад, конфеты | чай, огурец |
| `headgear` | кепка, шапка | майка, огурец |
| `knit-top` | футболка, майка, худи | кепка, огурец, кеды |
| `footwear` | кеды, кроссовки | майка, огурец |
| `computers` | ноутбук, смартфон | зарядка, огурец |
| `power` | зарядка, powerbank, кабель usb | ноутбук (bare), огурец |
| `headphones` | наушники, airpods | смартфон bare? (зафиксировать) |
| `cosmetics` | крем, духи | еда, огурец |
| `led` | led лампа, светодиодная лента | игрушка |
| `vape` | вейп, pod | зарядка bare |
| `toys` | игрушка, конструктор | консоль vs игрушка (оба toys — ок) |

**Спец-блок PRODUCE (обязательный):**

| Query | Pack | Preferred option / heading |
|-------|------|----------------------------|
| огурец / огурцы / огурец свежий | produce-fresh | fresh → **0707** |
| огурцы маринованные / корнишоны / консервированные огурцы | produce-fresh | prepared → **2001** |
| огурцы в рассоле / временно консервированные | produce-fresh | preserved → **0711** |
| йогурт | milk | fermented → **0403** |
| майка | knit-top | **не** produce |

---

## 5. Слои прогона (порядок)

```text
V1  Unit pack matrix (matchHintPack + hintTreeQuestions headings)
V2  Clarify apply: option → hsHint / composition / description fragment
V3  Search score: top family digits for produce + false friends
V4  Cascade + invoice aliases (уже частично; добить produce variants)
V5  Attr-suggest: produce policy (RULE или explicit clarify-only)
V6  Live probe (prod/preview): NewCalc «огурец» chips + search
V7  KB + current-app: статус зрелости packs
```

Ownership: Core (`tnved-hint-trees`, morph, cascade) + Client clarify apply. UI chrome **не** менять в Must (D32 hygiene C10).

---

## 6. Фазы реализации

| ID | Что | Done when | MoSCoW |
|----|-----|-----------|--------|
| **P0** | Этот план + ссылки в README / morph audit | merged docs | **done** (#37) |
| **P1** | Fixture `hint-pack-precision.json` + vitest: все packs × pos/neg | 100% на golden | **done** (этот PR) |
| **P2** | Produce fork apply unit (свежий/рассол/маринад → 0707/0711/2001) | 3 asserts | **Must** |
| **P3** | Search + cascade rows для маринованных / корнишонов; false-friend одежда | unit green | **Must** |
| **P4** | Attr-suggest: produce RULE **или** KB «clarify-only» + test | нет silent generic на «огурец» | **Should** |
| **P5** | `npm run test:hint-precision` в CI рядом с morphology | script + docs | **done** (with P1) |
| **P6** | Live checklist staging (NewCalc + search) | PASS notes in staging.md | **Should** |
| **P7** | Trigger hygiene (короткие stems вроде `лук`) + denylist expansion | miss-log driven | **Could** |

---

## 7. Проверка (команды)

```bash
# P1
npm run test:hint-precision
npm run test:tnved-morphology
npx vitest run src/lib/ved/__tests__/tnved-hint-trees.test.ts
npm run test:classify-cascade
npm run test:ci

# live (P6)
# /cabinet/new → «огурец» → chips 0707/0711/2001; не майка/йогурт
# search «огурец» → 07xx; «йогурт» → 0403
```

---

## 8. Жёстко не делать

- LLM CTA на clarify «чтобы точнее»  
- Один mega-pack «еда»  
- Ломать milk ради produce без boundary-test  
- Автозалив attrs без клика (D15)  
- Скрейп Альта / полный стеммер  
- Считать C35e ≥60% заменой pack-precision (разные метрики)

---

## 9. Связь с KB

| Файл | Действие |
|------|----------|
| Этот план | канон аудита |
| [`plan-tnved-hint-chains-audit.md`](./plan-tnved-hint-chains-audit.md) | ссылка §след. шаг → precision |
| [`plan-fill-hints-structure.md`](./plan-fill-hints-structure.md) | gap H3 dairy/produce |
| [`plan-tnved-hint-trees.md`](./plan-tnved-hint-trees.md) | produce fork |
| [`testing-branches.md`](./testing-branches.md) | `test:hint-precision` |
| [`staging.md`](./staging.md) | live P6 |
| [`current-app.md`](./current-app.md) | зрелость packs после ship |

---

## 10. Следующий шаг

1. ~~Merge план P0~~ **done** (#37).  
2. Merge этот PR (**P1**).  
3. Impl **P2–P3** (apply fork + cascade/search).  

Agent cannot merge — нужен human.
