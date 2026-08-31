# План: аудит цепочек подсказок ТН ВЭД (морфология + false friends)

**Дата:** 2026-08-31. **D33.**  
**Статус:** **planned** (решения §8 зафиксированы; код — после C35a).  
Канон: [`plan-fill-hints-structure.md`](./plan-fill-hints-structure.md) · [`plan-tnved-hint-trees.md`](./plan-tnved-hint-trees.md) · [`plan-classify-cascade-c23.md`](./plan-classify-cascade-c23.md) · [`plan-c35-offline-first-hs.md`](./plan-c35-offline-first-hs.md).

Связанный кейс: **«огурец»** в подсказках/поиске ведёт не туда (или в пустоту), рядом «йогурт» / молочные направления.  
PR плана: [#32](https://github.com/TikhonBaruch/Ibm-cargo/pull/32).

---

## 1. Идея

Не чинить по одному слову. Ввести **единый контракт матчинга** для всех слоёв подсказок ТН ВЭД и **максимальный** регресс-корпус «ложных друзей» + singular/plural (огур⊂йогурт, и т.п.).

---

## 2. Анализ: какие цепочки есть (as-is)

```text
Ввод описания (NewCalc)
  ├─ C12 clarify (heuristic / URL)     ← primary UI
  │    └─ C21 hint-tree packs          ← family forks (молоко, обувь, …)
  ├─ Directory search /api/v1/tnved/search
  │    └─ stems + titleRu/notes contains + score
  ├─ Cascade classify (create / preview)
  │    └─ code → alias → token index
  ├─ Attr-suggest / FieldSuggest       ← NewCalc: orphan / Dashboard only
  └─ Precedent suggest                 ← past calcs + БД-2
```

| Слой | Матчинг сегодня | Риск |
|------|-----------------|------|
| Search stems | `tnvedSearchStems`: слово ≥5 → `slice(0,-1)` | **ломает «огурец»→«огуре»**, не бьёт title «Огурцы» |
| Search notes | `notes.contains(stem)` | **false friend**: короткий stem `огур` ⊂ `йогурт` |
| C21 packs | `desc.includes(trigger)` (длинные) / word-boundary (≤3) | нет pack «овощи»; milk trigger `йогурт` ок, но поиск уже увёл |
| Cascade aliases | ключи / token index | нет invoice alias на 0707 |
| Attr-suggest | RULE по ключевым словам | нет produce RULE → generic purpose |

### Диагноз «огурец» (проверено 2026-08-31)

| Запрос | stems | Поиск | Pack C21 |
|--------|-------|-------|----------|
| **огурец** | `огурец`, **`огуре`** | **0 hits** (title «Огурцы» не содержит `огуре`) | null |
| **огурцы** | `огурцы`, `огурц` | HIT `0707000500` и соседи | null |
| **йогурт** | `йогурт`, `йогур` | milk / 0403 | **milk** |

Коды в БД есть: `070700…` «Огурцы», `071140`/`200110` (консервы). Проблема **не в каталоге**, а в **стемминге + отсутствии produce-pack**.

Дополнительный класс бага: если где-то используется stem длины 4 (`огур`), `notes.contains('огур')` поднимает **йогурт** (подстрока).

---

## 3. Концепция (как подходить)

### Принцип P1 — один матчер, много потребителей

Вынести `matchTnvedQuery(text)` / `tnvedQueryTokens(text)` в domain (`tnved-query-match` рядом с `tnvedSearchStems`):

- токены + **RU-морфология** для частых household окончаний (`-ец/-цы`, `-ка/-ки`, `-ие/-ия`, …) — не полный стеммер и не только `slice(-1)`;
- **word-boundary / token equality / prefix-of-token** для notes при score/filter;
- Search, cascade token index, C21 triggers, attr-suggest RULE — все зовут один helper.

### Принцип P2 — pack по семье товара, не по «похожести букв»

C21 packs = **семантика** (dairy / produce / apparel).  
Добавить pack **`produce-fresh`** (гл. 07): triggers `огурц`, `помидор`, `томат`, `картофел`, `лук`, `морков`, … → вопросы свежий/охлаждённый/консервы → headings `0707` / `0711` / `2001`.

### Принцип P3 — регресс-корпус **максимум** (блоки A–E)

Один fixture (как critical-hs); **не дублировать** critical HS — импортировать/переиспользовать.

| Блок | Содержание | Роль |
|------|------------|------|
| **A** Singular/plural | огурец/огурцы, кепка/кепки, носок/носки, помидор/помидоры, … | H1 stems |
| **B** False friends | огур↔йогурт + пары «короткий stem ⊂ длинного notes-токена» | H2 |
| **C** Critical HS | кепка, молоко, кеды, ноутбук — из существующих suites | regression |
| **D** Produce pack | томат, картофель, лук, морковь → гл. 07; **не** 04 | H3 |
| **E** Negative | стоп-слова / пустой q / мусор | fail-open |

Unit: stems + score/filter + `matchHintPack`. Live search — optional smoke, не блокер merge.

### Принцип P4 — не смешивать с C35 LLM gate

C35 = когда звать DeepSeek.  
Этот план = **качество offline матчинга** до LLM. Файлы ортогональны; **очередь merge** — см. §4 (стабильность).

---

## 4. Зафиксировано (диалог 2026-08-31)

| # | Вопрос | Решение |
|---|--------|---------|
| 1 | H2 boundary vs denylist | **Boundary / token-aware = Must** (класс бага). **Denylist = страховка** только из fixture-пар (не единственная защита). Пайплайн: SQL `contains` (recall) → score/filter + denylist (precision). |
| 2 | Размер корпуса | **Максимум** — блоки A–E (§3 P3). |
| 3 | Очередь vs C35 | **#32 (этот план) → C35a (#31+#33) → morph H1+H2+H3**. Не параллелить два code-PR в core матчинг/classify: меньше WIP, проще bisect; morph потом поднимает offline hit-rate, который C35e меряет. |

MoSCoW первого morph-PR: **H1+H2+H3 Must**; H4/H5 Should (можно follow-up).

---

## 5. Фазы

| ID | Что | Done when | MoSCoW |
|----|-----|-----------|--------|
| **H0** | KB этот план + решения §4 | merged docs (#32) | **Must** |
| **H1** | Stems: `огурец`→`огурц` (+ household endings); блок A | search HIT singular | **Must** |
| **H2** | Notes: boundary/token score; denylist из B | unit false-friend | **Must** |
| **H3** | C21 pack `produce-fresh` + clarify; блок D | pack on «огурец» | **Must** (1-й morph PR) |
| **H4** | Alias/search-extras notes для produce | `tnved:load -- --search-extras` | Should |
| **H5** | Audit script / CI прогон A–E | `npm run test:…` | Should |

Impl ветка: `cursor/tnved-hint-morphology-e1f0` (от `main` после C35a).

---

## 6. Не делать

- LLM CTA на clarify для овощей  
- Scraping  
- Ломать milk pack ради огурца без boundary-fix  
- Один гигантский pack «еда» на всё edible  
- Полный лингвистический стеммер / внешний morph API  
- Параллельный code-merge morph + C35a в один день без нужды  

---

## 7. Проверка

```bash
# после H1–H3
npx vitest run src/lib/ved/__tests__/tnved-search-morphology.test.ts  # new, A–E
npx vitest run src/components/ved/client/__tests__/critical-hs-queries.test.ts
npx vitest run src/lib/ved/__tests__/tnved-hint-trees.test.ts
npm run test:ci
# live (optional): search «огурец» → 070700… ; «йогурт» → 0403 ; pack огурец → produce-fresh
```

---

## 8. Следующий шаг

1. **Merge #32** (этот план).  
2. **C35a:** merge #31 (plan) → #33 (gate + dual-path).  
3. Impl **`cursor/tnved-hint-morphology-e1f0`:** H1+H2+H3 по §4.  
4. H4/H5 — follow-up при необходимости.
