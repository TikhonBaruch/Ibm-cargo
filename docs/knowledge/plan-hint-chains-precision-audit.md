# План: проверка точности цепочек подсказок (все packs, max precision)

**Дата:** 2026-08-31. **D33.**  
**Статус:** **P0–P6** on main (#37–#41) · **P7** (this PR #42) · human merge.  
Канон: [`plan-tnved-hint-chains-audit.md`](./plan-tnved-hint-chains-audit.md) (H0–H5) · [`plan-tnved-hint-trees.md`](./plan-tnved-hint-trees.md) · [`plan-fill-hints-structure.md`](./plan-fill-hints-structure.md) · [`plan-c35-offline-first-hs.md`](./plan-c35-offline-first-hs.md) · [`staging.md`](./staging.md) §P6 · D15 / D27 / D32.

Связанный страх продукта: запрос **«огурец»** снова тянет **одежду / молоко / чужой pack**; при этом огурец бывает **свежий** или **маринованный/консервы**.

---

## 1. Идея

Закрыть вопрос «на сколько проработаны цепочки» **измеримо**: не «кажется ок», а матрица **precision / no cross-family** по **всем** C21 packs + смежным слоям (search / cascade / attr-suggest). Цель цикла — **максимум из возможного** в offline heuristic (без LLM CTA на clarify).

---

## 2. Анализ: зрелость as-is (честно)

| Слой | Зрелость | Что уже есть | Дыры |
|------|----------|--------------|------|
| C21 packs | **высокая** на golden + short-trigger | 14 packs; produce fork; P7 `packTriggerMatches` | miss-log driven denylist growth |
| Morph H1–H3 | **высокая** на кейсе огурец≠йогурт | stems, denylist, unit A–E | Корпус A–E **узкий** относительно всех packs |
| H4 aliases | **частичная** | 0707/0702/0701 invoice | Нет полного produce leaf set; ops `--search-extras` может быть не прогнан на prod DB |
| Search score | **средняя** | boundary + denylist | Live directory top-N не зафиксирован fixture’ом на все families |
| Cascade | **высокая** на must-cover | C35e ≥60% offline-hit | Produce только 3 строки; нет cross-steal asserts в fixture |
| Attr-suggest | **средняя+** для produce | RULE socks/footwear/… + **produce clarify-only (P4)** | UI chips orphan на NewCalc (H1 fill-hints); live H6 post-merge |
| Clarify apply | **высокая** unit (P2 #39) | chips → `hsHint` 0707/0711/2001 | Merge #39 human; NewCalc manual H7 |

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
| **P1** | Fixture `hint-pack-precision.json` + vitest: все packs × pos/neg | 100% на golden | **done** (#38) |
| **P2** | Produce fork apply unit (свежий/рассол/маринад → 0707/0711/2001) | 3 asserts | **done** (#39) |
| **P3** | Search + cascade rows для маринованных / корнишонов; false-friend одежда | unit green | **done** (#40) |
| **P4** | Attr-suggest: produce RULE **clarify-only** + test | нет silent generic на «огурец» | **done** (#41) |
| **P5** | `npm run test:hint-precision` в CI рядом с morphology | script + docs | **done** (#38) |
| **P6** | Live checklist staging (NewCalc + search) | PASS notes in staging.md | **done** (#41; H6 post-merge) |
| **P7** | Trigger hygiene (короткие stems) + denylist + pepper policy | unit green | **done** (this PR #42) |

---

## 7. Проверка (команды)

```bash
# P1–P3 + P7 (this PR)
npm run test:hint-precision
npx vitest run src/components/ved/client/__tests__/new-calc-clarify.test.ts
npx vitest run src/lib/ved/__tests__/tnved-hint-trees.test.ts
npm run test:tnved-morphology
npm run test:classify-cascade
npm run test:ci

# live (P6, #41)
# /cabinet/new → «огурец» → chips 0707/0711/2001; не майка/йогурт
# search «огурец» → 07xx; «йогурт» → 0403
# P7: «полотенце»≠knit-top; «перец» bare ≠ produce; «сладкий перец» → produce
```

---

## 8. Жёстко не делать

- LLM CTA на clarify «чтобы точнее»  
- Один mega-pack «еда»  
- Ломать milk ради produce без boundary-test  
- Автозалив attrs без клика (D15)  
- Скрейп Альта / полный стеммер  
- Считать C35e ≥60% заменой pack-precision (разные метрики)  
- Bare «перец» → produce (специи 0904 vs овощи 0709)

---

## 9. Связь с KB

| Файл | Действие |
|------|----------|
| Этот план | канон аудита |
| [`plan-tnved-hint-chains-audit.md`](./plan-tnved-hint-chains-audit.md) | ссылка §след. шаг → precision |
| [`plan-fill-hints-structure.md`](./plan-fill-hints-structure.md) | gap H3 dairy/produce |
| [`plan-tnved-hint-trees.md`](./plan-tnved-hint-trees.md) | produce fork |
| [`testing-branches.md`](./testing-branches.md) | `test:hint-precision` (+ short-triggers) |
| [`staging.md`](./staging.md) | live P6 |
| [`current-app.md`](./current-app.md) | зрелость packs после ship |

---

### P2 notes (#39)

- `new-calc-clarify` apply path: fresh → **0707**, preserved → **0711**, prepared → **2001**; no apparel/dairy steal on apply.

### P3 notes (#40)

- Cascade + search rows: маринованные огурцы / корнишоны → **2001**; false-friend apparel queries stay non-produce.
- `critical-hs-queries` + `classify-cascade` fixture extended; `tnved-invoice-aliases.json` produce variants.

### P4 notes (#41)

- RULE id `produce` in `attr-suggest.ts`: огурец/томат/… (+ plurals); **clarify-only** via `extra.clarifyPack=produce-fresh` + notes; default `hsHint` **0707** (not apparel/dairy).
- Helper `attrSuggestIsClarifyOnly()`; unit + critical-hs asserts.

### P6 notes (#41)

- Checklist H1–H7 in [`staging.md`](./staging.md) §P6; live search `огурец` **PASS** on prod 2026-08-31.
- H6 attr-suggest live: re-probe after deploy to prod.

### P7 notes (this PR #42)

**Policy** (`packTriggerMatches` in `tnved-query-match.ts`, used by C21 `matchHintPack`):

| Trigger length | Match |
|----------------|--------|
| multi-word | substring as authored (`перец слад`) |
| ≤3 | exact token boundary only (`лук`, `чай`) |
| =4 | token **or** prefix, minus `SHORT_TRIGGER_FALSE_FRIENDS` (`поло`≠`полотенце`, `кофе`≠`кофеин`) |
| ≥5 | substring (`огурц`→`огурцы`, `луков`→`луковица`) |

**Produce:** add `луков`, sweet/bell pepper phrases; **no** bare `перец` (spice ambiguity). Coverage guards (plant dairy, pointer, juice, soup) preserved in `matchHintPack`.

**Tests:** `hint-short-triggers.test.ts` folded into `npm run test:hint-precision`.

---

## 10. Следующий шаг

1. ~~P0–P6~~ **done** (#37–#41).  
2. Merge this PR **P7** [#42](https://github.com/TikhonBaruch/Ibm-cargo/pull/42).  
3. Post-merge: H6 live attr-suggest on prod; miss-log → extend `SHORT_TRIGGER_FALSE_FRIENDS` as needed.

Agent cannot merge — нужен human.
