# План: аудит цепочек подсказок ТН ВЭД (морфология + false friends)

**Дата:** 2026-08-31. **D33.**  
**Статус:** **planned** (диагноз + концепция; код — отдельный цикл).  
Канон: [`plan-fill-hints-structure.md`](./plan-fill-hints-structure.md) · [`plan-tnved-hint-trees.md`](./plan-tnved-hint-trees.md) · [`plan-classify-cascade-c23.md`](./plan-classify-cascade-c23.md) · [`plan-c35-offline-first-hs.md`](./plan-c35-offline-first-hs.md).

Связанный кейс: **«огурец»** в подсказках/поиске ведёт не туда (или в пустоту), рядом «йогурт» / молочные направления.

---

## 1. Идея

Не чинить по одному слову. Ввести **единый контракт матчинга** для всех слоёв подсказок ТН ВЭД и регресс-корпус «ложных друзей» (огур⊂йогурт, и т.п.).

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

Вынести `matchTnvedQuery(text)` / `tnvedQueryTokens(text)` в domain:

- токены + **RU-морфология** для частых окончаний (`-ец/-цы`, `-ка/-ки`, `-ие/-ия`, …) — не только `slice(-1)`;
- **word-boundary** (или token equality / prefix-of-token) для notes, не голый `includes` на коротких stems;
- optional **denylist false-friends**: `{ queryStem: "огур", blockNoteToken: "йогурт" }` или симметрично «не считать hit, если matched token длиннее и не начинается с query».

Search, cascade token index, C21 triggers, attr-suggest RULE — все зовут один helper.

### Принцип P2 — pack по семье товара, не по «похожести букв»

C21 packs = **семантика** (dairy / produce / apparel).  
Добавить pack **`produce-fresh`** (гл. 07): triggers `огурц`, `помидор`, `томат`, `картофел`, `лук `, `морков`, … → вопросы свежий/охлаждённый/консервы → headings `0707` / `0711` / `2001`.

### Принцип P3 — регресс-корпус false friends + singular/plural

Файл fixture (как critical-hs):

| query | must hit chapter/code | must NOT |
|-------|----------------------|----------|
| огурец | 0707… | 0403 / йогурт |
| огурцы | 0707… | 0403 |
| йогурт | 0403 | 0707 |
| кепка / кепки | 6505 | — |
| … | | |

Unit: stems + `searchTnvedCodes` score + `matchHintPack`.

### Принцип P4 — не смешивать с C35 LLM gate

C35 = когда звать DeepSeek.  
Этот план = **качество offline матчинга** до LLM. Можно параллелить с C35a, но отдельный PR.

---

## 4. Фазы

| ID | Что | Done when |
|----|-----|-----------|
| **H0** | KB этот план + fixture list (огурец/йогурт + 10 пар) | merged docs |
| **H1** | Исправить stems: `огурец`→`огурц`; тест singular/plural | search HIT |
| **H2** | Notes match: boundary / token-aware; блок false-friend огур↔йогурт | unit |
| **H3** | C21 pack `produce-fresh` + clarify questions | pack on «огурец» |
| **H4** | Alias/search-extras notes для produce | `tnved:load -- --search-extras` |
| **H5** | Audit script: прогон корпуса по search+pack+cascade | CI или `npm run test:…` |

MoSCoW: H1+H2 **Must**; H3 **Should**; H4/H5 **Should**.

---

## 5. Не делать

- LLM CTA на clarify для овощей  
- Scraping  
- Ломать milk pack ради огурца без boundary-fix  
- Один гигантский pack «еда» на всё edible  

---

## 6. Проверка

```bash
# после H1–H2
npx vitest run src/lib/ved/__tests__/tnved-search-morphology.test.ts  # new
# live
# search «огурец» → 070700… ; «йогурт» → 0403 ; pack огурец → produce-fresh
```

---

## 7. Следующий шаг

1. Merge этого плана.  
2. Impl ветка `cursor/tnved-hint-morphology-e1f0`: H1+H2 (+ H3 если успевает).  
3. Не блокировать C35 plan/impl — ортогонально.
