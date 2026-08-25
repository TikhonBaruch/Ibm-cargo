# План: typeahead полей NewCalc (название / страна / материал / бренд / состав)

**Дата:** 2026-08-24. **D33.**  
Канон: [`feature-cycle.md`](./feature-cycle.md) · [`design-patterns.md`](./design-patterns.md) · [`plan-newcalc-hints.md`](./plan-newcalc-hints.md) · [`plan-llm-fill-hints.md`](./plan-llm-fill-hints.md) · [`calculation-fields.md`](./calculation-fields.md).

## 1. Идея

На `/cabinet/new` при вводе нескольких букв в выбранных полях показывать **вероятные значения** из локального словаря (не LLM). Свободный ввод сохраняется; клик по строке подставляет значение.

Поля: **название позиции**, **страна происхождения (ISO-2)**, **материал**, **бренд**, **состав**.

## 2. Анализ

| Есть | Нет |
|------|-----|
| Combobox HS / ManufacturerSuggest (API) | Prefix-suggest для attrs и имени позиции |
| Attr chips (heuristic POST, ≥3 символа) | Inline list при наборе в самом поле |
| Placeholders | Словарь «носки / ноут / авто / станок…» |

Hold: live LLM в инпутах (D27/D35); второй визуальный язык dropdown; wizard.

## 3. Структура

**Паттерн (D32):** combobox — reuse визуала `HsCodeAutocomplete` / `ManufacturerSuggest`, один shared `FieldSuggest`. Источник = domain dictionary (client-side filter), без нового HTTP.

| Kind | Источник | Порог |
|------|----------|-------|
| `itemName` | бытовые названия товаров | ≥1 символ или focus → top-N |
| `originCountry` | ISO-2 + RU label / aliases | то же; value = код |
| `material` / `brand` / `composition` | кураторский список | то же |

Фритекст всегда ок. Не автозалив без клика.

## 4. Реализация

1. Domain `field-suggest.ts` + unit.
2. UI `FieldSuggest.tsx` в `ved/client/`.
3. Wire `NewCalcPane` (+ Dashboard quick: страна / состав).
4. KB: этот план · `calculation-fields.md` · client README · `design-patterns.md`.

## 5. Проверка

- Unit: filter «нос» → носки; «ки» → CN (Китай); пустой q → top-N.
- Ручной: NewCalc — dropdown не клипается; Escape / blur закрывает; HS/manufacturer не ломаются.

## 6. Статус

| Срез | Статус |
|------|--------|
| План | **done** |
| Domain + unit | **done** — `field-suggest.ts` (+ `partyDescription` / `shipCountry` / `resolveOriginCountryCode`) |
| UI + NewCalc / Dashboard | **done** — `FieldSuggest` multiline; origin без `maxLength=2` на наборе |
| Bugfix описание/страна | **done** — [`plan-field-suggest-fix.md`](./plan-field-suggest-fix.md) |
| KB close | **done** |

## Follow-up — precedent typeahead (2026-08-24)

См. [`plan-precedent-suggest-service.md`](./plan-precedent-suggest-service.md): API «Прецеденты из прошлых заявок» + query guard; словарь остаётся fail-open хвостом.
