# План: закрыть хвосты сессии (полосы / зомби-PR / петля hsHint)

**D33.** Дата: 2026-09-04.  
**Статус:** **done** 2026-09-04.  
**База:** `origin/main` @ `0932863` (после #89 directory hints).  
**Канон:** [`feature-cycle.md`](./feature-cycle.md) · [`ved-scratch.mdc`](./ved-scratch.mdc) · [`plan-newcalc-directory-hints.md`](./plan-newcalc-directory-hints.md) · [`design.md`](./design.md) §«Внешний макет».

Не фичи каталога и не смена default `AI_CHAIN`. Собрать то, что уже сделано, но не закреплено.

## 1. Идея

После #86–#89 на проде живы OCR-A, CI hygiene и сайдбар справочника. Вокруг них остались дыры процесса и одна незакрытая продуктовая петля. Этот план — реестр + срез «сделать сейчас».

## 2. Реестр (аудит 2026-09-04)

| ID | Что | Срез |
|----|-----|------|
| L1 | Правила полос (gitignore, scratch, design ingest) только в working tree на влитой ветке | **этот PR** |
| L2 | Нет `.cursorignore` — дампы всё ещё в индексе IDE | **этот PR** |
| L3 | `~/Projects/SESSION.md` указывает на taurus+llm (17 авг) | **этот PR** (файл вне git) |
| L4 | Локальный `main` отстаёт от `origin/main` | **этот PR** (указатель) |
| L5 | [#67](https://github.com/TikhonBaruch/Ibm-cargo/pull/67) CONFLICTING; [#17](https://github.com/TikhonBaruch/Ibm-cargo/pull/17) перекрыт C21 на main | **закрыть** с комментарием |
| L6 | Сайдбар пишет `hsHint`, create его спредит, брокер читает `hint:` — E2E не гоняли; C21 не перетирает справочник, справочник перетирает C21 — в UI не сказано | **этот PR:** helper + unit + одна meta-строка |
| L7 | `design-parity.md` не знает сайдбар NewCalc; OCR-A план ещё «ждёт Production» | **этот PR** KB honesty |
| L8 | `tnved:load -- --search-extras` на sweb | **Won't** — Sensitive `DATABASE_URL`, отдельный ops |
| L9 | Card-enrich / invoice-enrich в stash | **Won't** — свой worktree, не pop |
| L10 | C36 P5 default `AI_CHAIN`; orphan chips; мобилка #20/#21; handover #18 | **Won't** — hold / отдельные треки |
| L11 | C35d/e план всё ещё «этот PR» | **Won't** — не переписывать C35 здесь |

## 3. Фазы

| # | Что | Где |
|---|-----|-----|
| A | `chore/leftover-closeout` от `origin/main`; L1+L2 в репо | gitignore, `.cursorignore`, `ved-scratch.mdc`, cycle/AGENTS/design |
| B | L6: `preferExistingHsHint`; meta под CTA; hygiene что create сохраняет `attrs` | `new-calc-directory-hints.ts`, NewCalc*, tests |
| C | L7 parity + OCR-A **done** на prod (#86/#87) | KB |
| D | L3 SESSION; L4 `main` → `origin/main`; L5 close #67 #17 | вне diff / `gh` |
| E | `test:ci` → PR | не деплоить ради docs, но ветка обычная |

## 4. Не делать

- `tnved:load` / card-enrich / pop stash.
- Merge #67 as-is.
- Смена `AI_CHAIN`.
- Wire `HsHintCandidates` / `AttrSuggestChips`.
- Новый visual / SW bump без смены chrome (cache `lbm-v2` жив).
- Комментарии в чате про игнорируемые дампы.

## 5. Проверка

- Unit: `preferExistingHsHint` (пустой / уже взят / directory не затирается C21).
- Hygiene: NewCalc create спредит `base.attrs`; CTA meta про приоритет справочника.
- `npm run test:ci`.
- Ручной (если сессия клиента жива): взять код → оплата mock → брокер `hint:`.

Restore: revert этого PR; SESSION вернуть вручную.
