# План: подсказки справочника в сайдбаре `/cabinet/new`

**D33.** Дата: 2026-09-04.  
**Статус:** **done**  
**База:** `origin/main` @ `23ab3d6` (после CI hygiene #88).  
**Канон:** [`plan-lbm-bro-tnved-dir.md`](./plan-lbm-bro-tnved-dir.md) · [`plan-tnved-client-hs-blur.md`](./plan-tnved-client-hs-blur.md) · [`plan-tnved-directory-leaf-only.md`](./plan-tnved-directory-leaf-only.md) · [`plan-lbm-bro-newcalc-clarify.md`](./plan-lbm-bro-newcalc-clarify.md) (C10: нет `HsCodeAutocomplete` в форме) · [`plan-fill-hints-structure.md`](./plan-fill-hints-structure.md).

Не путать с [`plan-client-tnved-search.md`](./plan-client-tnved-search.md) срез 1 (combobox в поле позиции): C10 этот combobox снял. Этот план — **другой виджет**: трей в `wiz-side`, не поле HS в форме.

## 1. Идея

На шаге «Товар», режим **одна позиция**, в правой колонке под «По заявке» — блок **«Подсказки справочника»**: те же 10-значные листья, что `/cabinet/tnved` (`leafOnly=1`, blur после 3 цифр). Описание в трее свёрнуто. Клик раскрывает компактную карточку. CTA **«Взять этот код в заявку»** пишет только `attrs.hsHint` (D15), не `hsCodeFinal`.

Синяя плашка «код после оплаты» остаётся `— — —` до оплаты (D11).

## 2. Анализ

| Уже есть | Не трогаем |
|----------|------------|
| `GET /api/v1/tnved/search?leafOnly=1` (CLIENT) | Новый search / dual-path writer |
| `GET /api/v1/tnved/:code` + `directoryReadFromCard` | PSN / related / группы 01–97 в сайдбаре |
| `ClientMaskedHsCode` + `.tnved-hits` | `HsCodeAutocomplete` в форме (C10) |
| Apply `hsHint` со справочника (`directoryPrefillFromQuery`) | Запись полного кода в textarea |
| C21 «Уточняем…» слева | Мультипозиция (справочник сам не классифицирует пакет) |
| `HsHintCandidates` (orphan, полный код) | Не монтировать; не смешивать heuristic и БД |

Запрос = первая строка наименования/описания, debounce 250 мс, limit 5. Пустой/короткий ввод — блока нет.

## 3. Клик

| Действие | UI | Domain |
|----------|----|--------|
| Описание ≥2 символов, single, шаг 1 | Трей хитов (маска + 2 строки title) | GET search `leafOnly=1` |
| Клик по хиту | Карточка: маска, title, why, пошлина/НДС, disclaimer, CTA | GET `:code` |
| «Взять этот код в заявку» | `hsHint` на позицию 0; CTA → «Код взят в заявку» | create как сейчас, `hsHint` в attrs |
| Мульти / шаг Оплата/Код | Блок скрыт | — |
| Нет хитов | meta «Ничего не нашли» | fail-open |
| Ошибка search | meta, без toast | fail-open |

## 4. Не делать

- `HsCodeAutocomplete` / сырой 10-знак в DOM трея.
- CTA «Оформить заявку по этому коду» (заявка уже открыта).
- Подставлять код в hero «код после оплаты».
- Писать полный HS в description (утечка маски).
- LLM / classify с формы.
- Монтировать `HsHintCandidates`.
- Handoff ТН ВЭД, OCR, C21.

Паттерн (D32): **suggestion list + progressive disclosure** — reuse `.tnved-hits` / `.tnved-read`, не второй dropdown и не drawer.

## 5. Фазы

| # | Что | Где |
|---|-----|-----|
| A | Gate helper `directoryHintsQuery` / `shouldShowDirectoryHints` + unit | `new-calc-directory-hints.ts` |
| B | `NewCalcDirectoryHints` (search + tray + card + apply) | `ved/client` |
| C | Wire в `NewCalcPane` aside, шаг 1, `!isPack` | UI |
| D | Hygiene + KB | `public-surface-hygiene`, этот файл, `current-app`, README |

## 6. Проверка

- Unit: query gate (пусто / 1 символ / первая строка / pack off).
- Hygiene: NewCalc содержит `NewCalcDirectoryHints`; нет `HsCodeAutocomplete`; CTA не «Оформить заявку по этому коду»; «Код после оплаты» жив; C21 жив.
- `npm run test:ci` (unit + typecheck + structure + contracts + verify).
- Ручной: `/cabinet/new` «ноутбук» → 847 + blur в сайдбаре → раскрытие → взять в заявку → hero всё ещё `— — —`; мульти без блока.

Restore: git до этой ветки.
